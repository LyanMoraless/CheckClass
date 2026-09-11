import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as webauthnBrowser from '@simplewebauthn/browser';
import * as authStorage from '../../lib/auth-storage';
import * as bindingApi from './device-binding-api';
import { useDeviceBindingSession } from './use-device-binding-session';

// NOTE (Testing Agent, 2026-09-11): vitest/@testing-library/react are not
// installed in frontend/package.json yet (pre-existing gap, not introduced by
// Frente 12 — see architecture-overview.md's "Implementação — Vínculo de
// Dispositivo Institucional" item 4). This spec cannot be run today; it is
// written as typed documentation of use-device-binding-session.ts's intended
// behavior, same posture already established by jwt.spec.ts and
// device-binding-config-page.spec.ts. It has NOT been executed — treat it as
// a design record to validate once the tooling gap is closed (Tech Decision
// scope), not as proof the hook currently behaves this way.
//
// This hook is the single highest-risk piece of the whole Frente 12 frontend
// surface: a mount-once async bootstrap racing a component unmount, two
// independently-scheduled setTimeout timers (Gatilhos 3/4, RULE-DEV-06), and
// a best-effort checkout that must never throw. Covered here: rehydration vs.
// capability-offer branching (including the GAP-09 "no capability" and
// capability-check-throws paths), both timers actually firing and triggering
// checkout, the bind ceremony's success/failure paths, and
// checkoutBeforeLogout's "nothing to check out" no-op.
function buildToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature-not-checked-client-side`;
}

describe('useDeviceBindingSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-11T10:00:00.000Z'));
    vi.spyOn(authStorage, 'getStoredToken').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('mount-once rehydrate-or-offer bootstrap', () => {
    it('test_mount_noExistingBindingAndCapableDevice_offersDeviceLink', async () => {
      vi.spyOn(bindingApi, 'getMyActiveBinding').mockResolvedValue(null);
      vi.spyOn(webauthnBrowser, 'platformAuthenticatorIsAvailable').mockResolvedValue(true);

      const { result } = renderHook(() => useDeviceBindingSession());

      expect(result.current.offerState).toBe('checking');
      await waitFor(() => expect(result.current.offerState).toBe('offering'));
      expect(result.current.activeBinding).toBeNull();
    });

    // GAP-09 (RULE-DEV-02's degradation note): no TPM/no WebAuthn support —
    // never any UI at all, not even an error.
    it('test_mount_noExistingBindingAndIncapableDevice_staysHiddenWithNoUi', async () => {
      vi.spyOn(bindingApi, 'getMyActiveBinding').mockResolvedValue(null);
      vi.spyOn(webauthnBrowser, 'platformAuthenticatorIsAvailable').mockResolvedValue(false);

      const { result } = renderHook(() => useDeviceBindingSession());

      await waitFor(() => expect(result.current.offerState).toBe('hidden'));
    });

    it('test_mount_capabilityCheckRejects_treatedAsIncapableNeverThrows', async () => {
      vi.spyOn(bindingApi, 'getMyActiveBinding').mockResolvedValue(null);
      vi.spyOn(webauthnBrowser, 'platformAuthenticatorIsAvailable').mockRejectedValue(new Error('not supported in this context'));

      const { result } = renderHook(() => useDeviceBindingSession());

      await waitFor(() => expect(result.current.offerState).toBe('hidden'));
    });

    it('test_mount_existingActiveBinding_rehydratesWithoutOfferingAndSchedulesTimers', async () => {
      const existing: bindingApi.DeviceBinding = {
        id: 'binding-1',
        personId: 'person-1',
        deviceIdentityId: 'device-1',
        status: 'active',
        startedAt: '2026-09-11T10:00:00.000Z',
        checkedOutAt: null,
        checkoutReason: null,
        createdAt: '2026-09-11T10:00:00.000Z',
        updatedAt: '2026-09-11T10:00:00.000Z',
      };
      vi.spyOn(bindingApi, 'getMyActiveBinding').mockResolvedValue(existing);
      vi.spyOn(bindingApi, 'getDeviceBindingConfig').mockResolvedValue({ inactivityTimeoutMinutes: 30, isDefault: false });
      const capabilitySpy = vi.spyOn(webauthnBrowser, 'platformAuthenticatorIsAvailable');

      const { result } = renderHook(() => useDeviceBindingSession());

      await waitFor(() => expect(result.current.offerState).toBe('hidden'));
      expect(result.current.activeBinding).toEqual(existing);
      // An already-bound session never runs Tech Decision C's capability
      // check at all — the offer only ever applies to an UNBOUND device.
      expect(capabilitySpy).not.toHaveBeenCalled();
    });

    it('test_mount_existingBindingButConfigFetchFails_stillRehydratesUsingFallbackTimeout', async () => {
      const existing: bindingApi.DeviceBinding = {
        id: 'binding-1',
        personId: 'person-1',
        deviceIdentityId: 'device-1',
        status: 'active',
        startedAt: '2026-09-11T10:00:00.000Z',
        checkedOutAt: null,
        checkoutReason: null,
        createdAt: '2026-09-11T10:00:00.000Z',
        updatedAt: '2026-09-11T10:00:00.000Z',
      };
      vi.spyOn(bindingApi, 'getMyActiveBinding').mockResolvedValue(existing);
      vi.spyOn(bindingApi, 'getDeviceBindingConfig').mockRejectedValue(new Error('network error'));
      const checkoutSpy = vi.spyOn(bindingApi, 'checkoutMyBinding').mockResolvedValue({ checkedOut: true });

      const { result } = renderHook(() => useDeviceBindingSession());
      await waitFor(() => expect(result.current.offerState).toBe('hidden'));

      // Fallback is 30 minutes (device-binding-config.service.ts's own
      // DEFAULT_INACTIVITY_TIMEOUT_MINUTES) — advancing just short of it must
      // NOT have fired the checkout yet.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(29 * 60_000);
      });
      expect(checkoutSpy).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2 * 60_000);
      });
      expect(checkoutSpy).toHaveBeenCalledWith('inactivity_timeout');
    });
  });

  describe('Gatilho 3 — inactivity timeout (RULE-DEV-06)', () => {
    it('test_inactivityTimerFiresAtConfiguredMinutes_checksOutAndClearsBindingLocally', async () => {
      const existing: bindingApi.DeviceBinding = {
        id: 'binding-1',
        personId: 'person-1',
        deviceIdentityId: 'device-1',
        status: 'active',
        startedAt: '2026-09-11T10:00:00.000Z',
        checkedOutAt: null,
        checkoutReason: null,
        createdAt: '2026-09-11T10:00:00.000Z',
        updatedAt: '2026-09-11T10:00:00.000Z',
      };
      vi.spyOn(bindingApi, 'getMyActiveBinding').mockResolvedValue(existing);
      vi.spyOn(bindingApi, 'getDeviceBindingConfig').mockResolvedValue({ inactivityTimeoutMinutes: 5, isDefault: false });
      const checkoutSpy = vi.spyOn(bindingApi, 'checkoutMyBinding').mockResolvedValue({ checkedOut: true });

      const { result } = renderHook(() => useDeviceBindingSession());
      await waitFor(() => expect(result.current.activeBinding).toEqual(existing));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60_000);
      });

      expect(checkoutSpy).toHaveBeenCalledWith('inactivity_timeout');
      expect(result.current.activeBinding).toBeNull();
    });

    // Tech Decision B's own honesty note: best-effort, no client-side retry —
    // a failed checkout call must still clear the LOCAL binding state (the
    // server's lazy sweep is the real safety net from here on).
    it('test_inactivityTimerFiresAndServerCallFails_stillClearsLocalBindingWithoutThrowing', async () => {
      const existing: bindingApi.DeviceBinding = {
        id: 'binding-1',
        personId: 'person-1',
        deviceIdentityId: 'device-1',
        status: 'active',
        startedAt: '2026-09-11T10:00:00.000Z',
        checkedOutAt: null,
        checkoutReason: null,
        createdAt: '2026-09-11T10:00:00.000Z',
        updatedAt: '2026-09-11T10:00:00.000Z',
      };
      vi.spyOn(bindingApi, 'getMyActiveBinding').mockResolvedValue(existing);
      vi.spyOn(bindingApi, 'getDeviceBindingConfig').mockResolvedValue({ inactivityTimeoutMinutes: 5, isDefault: false });
      vi.spyOn(bindingApi, 'checkoutMyBinding').mockRejectedValue(new Error('network error'));

      const { result } = renderHook(() => useDeviceBindingSession());
      await waitFor(() => expect(result.current.activeBinding).toEqual(existing));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60_000);
      });

      expect(result.current.activeBinding).toBeNull();
    });
  });

  describe('Gatilho 4 — token expiry (RULE-DEV-06 emendada)', () => {
    it('test_tokenExpiryTimerFiresAtTokenExp_checksOutWithTokenExpiredReason', async () => {
      // exp is a Unix seconds timestamp 10 minutes after the mocked "now".
      const expiryEpochSeconds = Math.floor(new Date('2026-09-11T10:10:00.000Z').getTime() / 1000);
      vi.spyOn(authStorage, 'getStoredToken').mockReturnValue(buildToken({ exp: expiryEpochSeconds }));

      const existing: bindingApi.DeviceBinding = {
        id: 'binding-1',
        personId: 'person-1',
        deviceIdentityId: 'device-1',
        status: 'active',
        startedAt: '2026-09-11T10:00:00.000Z',
        checkedOutAt: null,
        checkoutReason: null,
        createdAt: '2026-09-11T10:00:00.000Z',
        updatedAt: '2026-09-11T10:00:00.000Z',
      };
      vi.spyOn(bindingApi, 'getMyActiveBinding').mockResolvedValue(existing);
      // Inactivity timeout deliberately far longer than the token's expiry,
      // so this test isolates Gatilho 4 from Gatilho 3 firing first.
      vi.spyOn(bindingApi, 'getDeviceBindingConfig').mockResolvedValue({ inactivityTimeoutMinutes: 120, isDefault: false });
      const checkoutSpy = vi.spyOn(bindingApi, 'checkoutMyBinding').mockResolvedValue({ checkedOut: true });

      const { result } = renderHook(() => useDeviceBindingSession());
      await waitFor(() => expect(result.current.activeBinding).toEqual(existing));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60_000);
      });

      expect(checkoutSpy).toHaveBeenCalledWith('token_expired');
    });

    it('test_tokenUnreadableOrMissingExpClaim_neverSchedulesGatilho4WithoutThrowing', async () => {
      vi.spyOn(authStorage, 'getStoredToken').mockReturnValue('not-a-valid-jwt');
      const existing: bindingApi.DeviceBinding = {
        id: 'binding-1',
        personId: 'person-1',
        deviceIdentityId: 'device-1',
        status: 'active',
        startedAt: '2026-09-11T10:00:00.000Z',
        checkedOutAt: null,
        checkoutReason: null,
        createdAt: '2026-09-11T10:00:00.000Z',
        updatedAt: '2026-09-11T10:00:00.000Z',
      };
      vi.spyOn(bindingApi, 'getMyActiveBinding').mockResolvedValue(existing);
      vi.spyOn(bindingApi, 'getDeviceBindingConfig').mockResolvedValue({ inactivityTimeoutMinutes: 120, isDefault: false });
      const checkoutSpy = vi.spyOn(bindingApi, 'checkoutMyBinding').mockResolvedValue({ checkedOut: true });

      const { result } = renderHook(() => useDeviceBindingSession());
      await waitFor(() => expect(result.current.activeBinding).toEqual(existing));

      // Advance well past any plausible token lifetime — only the (120 min)
      // inactivity timer should ever be pending; nothing must fire yet.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60 * 60_000);
      });
      expect(checkoutSpy).not.toHaveBeenCalled();
    });
  });

  describe('bindThisDevice (Tech Decision C ceremony)', () => {
    it('test_bindThisDevice_success_setsActiveBindingAndOfferStateBound', async () => {
      vi.spyOn(bindingApi, 'getMyActiveBinding').mockResolvedValue(null);
      vi.spyOn(webauthnBrowser, 'platformAuthenticatorIsAvailable').mockResolvedValue(true);
      vi.spyOn(bindingApi, 'generateLoginOptions').mockResolvedValue({
        options: {} as never,
        challengeToken: 'challenge-token-1',
      });
      vi.spyOn(webauthnBrowser, 'startAuthentication').mockResolvedValue({ id: 'assertion-1' } as never);
      const newBinding: bindingApi.DeviceBinding = {
        id: 'binding-2',
        personId: 'person-1',
        deviceIdentityId: 'device-2',
        status: 'active',
        startedAt: '2026-09-11T10:00:00.000Z',
        checkedOutAt: null,
        checkoutReason: null,
        createdAt: '2026-09-11T10:00:00.000Z',
        updatedAt: '2026-09-11T10:00:00.000Z',
      };
      vi.spyOn(bindingApi, 'completeLogin').mockResolvedValue({ binding: newBinding, inactivityTimeoutMinutes: 30 });

      const { result } = renderHook(() => useDeviceBindingSession());
      await waitFor(() => expect(result.current.offerState).toBe('offering'));

      await act(async () => {
        await result.current.bindThisDevice();
      });

      expect(result.current.offerState).toBe('bound');
      expect(result.current.activeBinding).toEqual(newBinding);
    });

    // RULE-DEV-02/GAP-09's posture extended to every ceremony failure — no
    // enrolled credential, the person cancelling the platform prompt, a
    // network error — all land here, never block the already-completed login.
    it('test_bindThisDevice_anyFailure_setsOfferStateFailedWithoutCreatingBinding', async () => {
      vi.spyOn(bindingApi, 'getMyActiveBinding').mockResolvedValue(null);
      vi.spyOn(webauthnBrowser, 'platformAuthenticatorIsAvailable').mockResolvedValue(true);
      vi.spyOn(bindingApi, 'generateLoginOptions').mockResolvedValue({ options: {} as never, challengeToken: 'challenge-token-1' });
      vi.spyOn(webauthnBrowser, 'startAuthentication').mockRejectedValue(new Error('user cancelled the platform prompt'));

      const { result } = renderHook(() => useDeviceBindingSession());
      await waitFor(() => expect(result.current.offerState).toBe('offering'));

      await act(async () => {
        await result.current.bindThisDevice();
      });

      expect(result.current.offerState).toBe('failed');
      expect(result.current.activeBinding).toBeNull();
    });
  });

  describe('dismissOffer', () => {
    it('test_dismissOffer_fromOffering_setsHidden', async () => {
      vi.spyOn(bindingApi, 'getMyActiveBinding').mockResolvedValue(null);
      vi.spyOn(webauthnBrowser, 'platformAuthenticatorIsAvailable').mockResolvedValue(true);

      const { result } = renderHook(() => useDeviceBindingSession());
      await waitFor(() => expect(result.current.offerState).toBe('offering'));

      act(() => result.current.dismissOffer());

      expect(result.current.offerState).toBe('hidden');
    });
  });

  describe('checkoutBeforeLogout (Gatilho 1)', () => {
    it('test_checkoutBeforeLogout_noActiveBinding_neverCallsCheckoutEndpoint', async () => {
      vi.spyOn(bindingApi, 'getMyActiveBinding').mockResolvedValue(null);
      vi.spyOn(webauthnBrowser, 'platformAuthenticatorIsAvailable').mockResolvedValue(false);
      const checkoutSpy = vi.spyOn(bindingApi, 'checkoutMyBinding');

      const { result } = renderHook(() => useDeviceBindingSession());
      await waitFor(() => expect(result.current.offerState).toBe('hidden'));

      await act(async () => {
        await result.current.checkoutBeforeLogout();
      });

      expect(checkoutSpy).not.toHaveBeenCalled();
    });

    it('test_checkoutBeforeLogout_activeBindingPresent_checksOutWithLogoutReason', async () => {
      const existing: bindingApi.DeviceBinding = {
        id: 'binding-1',
        personId: 'person-1',
        deviceIdentityId: 'device-1',
        status: 'active',
        startedAt: '2026-09-11T10:00:00.000Z',
        checkedOutAt: null,
        checkoutReason: null,
        createdAt: '2026-09-11T10:00:00.000Z',
        updatedAt: '2026-09-11T10:00:00.000Z',
      };
      vi.spyOn(bindingApi, 'getMyActiveBinding').mockResolvedValue(existing);
      vi.spyOn(bindingApi, 'getDeviceBindingConfig').mockResolvedValue({ inactivityTimeoutMinutes: 30, isDefault: false });
      const checkoutSpy = vi.spyOn(bindingApi, 'checkoutMyBinding').mockResolvedValue({ checkedOut: true });

      const { result } = renderHook(() => useDeviceBindingSession());
      await waitFor(() => expect(result.current.activeBinding).toEqual(existing));

      await act(async () => {
        await result.current.checkoutBeforeLogout();
      });

      expect(checkoutSpy).toHaveBeenCalledWith('logout');
      expect(result.current.activeBinding).toBeNull();
    });
  });
});
