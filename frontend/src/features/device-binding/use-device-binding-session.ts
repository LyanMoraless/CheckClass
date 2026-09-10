import { platformAuthenticatorIsAvailable, startAuthentication } from '@simplewebauthn/browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getStoredToken } from '../../lib/auth-storage';
import { getJwtExpiryMs } from '../../lib/jwt';
import {
  checkoutMyBinding,
  completeLogin,
  generateLoginOptions,
  getDeviceBindingConfig,
  getMyActiveBinding,
  type CheckoutReason,
  type DeviceBinding,
} from './device-binding-api';

// 'checking' — capability/rehydration check still in flight, nothing to show.
// 'hidden' — either rehydrated an existing binding, or the capability check
//   came back false/unavailable (GAP-09) — no UI, ever, for that case.
// 'offering' — capable and unbound: the one state device-link-prompt.tsx
//   renders the "vincular este dispositivo" banner for.
// 'binding' — ceremony in progress (disables the offer's own button).
// 'bound' — just succeeded, shown briefly so the person gets confirmation.
// 'failed' — the ceremony failed for ANY reason (see bindThisDevice below).
export type BindOfferState = 'checking' | 'hidden' | 'offering' | 'binding' | 'bound' | 'failed';

export interface DeviceBindingSession {
  activeBinding: DeviceBinding | null;
  offerState: BindOfferState;
  bindThisDevice: () => Promise<void>;
  dismissOffer: () => void;
  checkoutBeforeLogout: () => Promise<void>;
}

const FALLBACK_INACTIVITY_TIMEOUT_MINUTES = 30; // device-binding-config.service.ts's own DEFAULT_INACTIVITY_TIMEOUT_MINUTES.

// Owns the whole client-side lifecycle of RULE-DEV-06's checkout Gatilhos
// 1/3/4 (Tech Decision B, opção C) plus the post-login capability offer
// (Tech Decision C / GAP-09). Meant to be called once, high in the
// authenticated tree (app-shell.tsx) — modelled after auth-context.tsx's own
// mount-time bootstrap effect (Promise-based, not useQuery: this is session
// lifecycle plumbing with imperative side effects — timers, not page data —
// same category of concern AuthProvider already handles the same way).
// AppShell's lifetime IS the authenticated session's lifetime (it doesn't
// remount between routes), which is exactly what both decisions need: the
// capability check runs "logo após o login" whether that login just
// happened or survived a page reload, and the checkout timers live exactly
// as long as the binding they belong to.
export function useDeviceBindingSession(): DeviceBindingSession {
  const [activeBinding, setActiveBindingState] = useState<DeviceBinding | null>(null);
  const [offerState, setOfferState] = useState<BindOfferState>('checking');
  const activeBindingRef = useRef<DeviceBinding | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setBinding = useCallback((binding: DeviceBinding | null) => {
    activeBindingRef.current = binding;
    setActiveBindingState(binding);
  }, []);

  const clearTimers = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (tokenTimerRef.current) clearTimeout(tokenTimerRef.current);
    inactivityTimerRef.current = null;
    tokenTimerRef.current = null;
  }, []);

  // Gatilhos 1/3/4 all converge here (device-binding.controller.ts's own
  // checkout() comment: "only reason varies"). Best-effort by design (Tech
  // Decision B's explicit honesty note, approved as-is) — a failed request
  // here has no further client-side retry; the server's lazy sweep is the
  // real safety net, not this call succeeding.
  const performCheckout = useCallback(
    async (reason: CheckoutReason) => {
      clearTimers();
      try {
        await checkoutMyBinding(reason);
      } catch {
        // Best-effort — see Tech Decision B's honesty note in
        // architecture-overview.md. Nothing else to do client-side.
      }
      setBinding(null);
    },
    [clearTimers, setBinding],
  );

  // Tech Decision B, Gatilhos 3/4: one setTimeout each, scheduled once (at
  // binding creation, or rehydrated after a reload) — never reset by
  // activity, exactly as the approved mechanism describes ("setTimeout
  // agendado na criação do vínculo").
  const scheduleTimers = useCallback(
    (binding: DeviceBinding, inactivityTimeoutMinutes: number) => {
      clearTimers();

      const startedAtMs = new Date(binding.startedAt).getTime();
      const inactivityDelay = Math.max(0, startedAtMs + inactivityTimeoutMinutes * 60_000 - Date.now());
      inactivityTimerRef.current = setTimeout(() => {
        void performCheckout('inactivity_timeout');
      }, inactivityDelay);

      const token = getStoredToken();
      const expiryMs = token ? getJwtExpiryMs(token) : null;
      if (expiryMs !== null) {
        const tokenDelay = Math.max(0, expiryMs - Date.now());
        tokenTimerRef.current = setTimeout(() => {
          void performCheckout('token_expired');
        }, tokenDelay);
      }
      // No else branch: an unreadable/missing exp claim just means Gatilho 4
      // isn't scheduled client-side for this session — the server's 401 on
      // actual token expiry still ends the session via api-client's
      // onUnauthorized, same as it always has.
    },
    [clearTimers, performCheckout],
  );

  // Mount-once bootstrap: rehydrate an existing binding (page reload/new
  // tab) or, if there is none, run Tech Decision C's capability check.
  useEffect(() => {
    let cancelled = false;

    async function rehydrateOrOffer() {
      const existing = await getMyActiveBinding().catch(() => null);
      if (cancelled) return;

      if (existing) {
        setBinding(existing);
        const config = await getDeviceBindingConfig().catch(() => null);
        if (cancelled) return;
        scheduleTimers(existing, config?.inactivityTimeoutMinutes ?? FALLBACK_INACTIVITY_TIMEOUT_MINUTES);
        setOfferState('hidden');
        return;
      }

      // Tech Decision C: async, non-blocking, and only ever gates whether
      // the "vincular este dispositivo" UI appears at all — never gates the
      // person's own login, which has already completed by the time this
      // hook mounts (AppShell only renders once ProtectedRoute confirms
      // status === 'authenticated').
      const capable = await platformAuthenticatorIsAvailable().catch(() => false);
      if (cancelled) return;
      setOfferState(capable ? 'offering' : 'hidden');
    }

    void rehydrateOrOffer();
    return () => {
      cancelled = true;
    };
    // Intentionally mount-only — see header comment. setBinding/scheduleTimers
    // are stable (useCallback with stable deps), so omitting them is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const bindThisDevice = useCallback(async () => {
    setOfferState('binding');
    try {
      const { options, challengeToken } = await generateLoginOptions();
      const response = await startAuthentication({ optionsJSON: options });
      const { binding, inactivityTimeoutMinutes } = await completeLogin(challengeToken, response);
      setBinding(binding);
      scheduleTimers(binding, inactivityTimeoutMinutes);
      setOfferState('bound');
    } catch {
      // RULE-DEV-02/GAP-09's "treated exactly like an unknown machine" posture
      // extended to every possible failure here (no enrolled credential on
      // this browser — the common case for a machine nobody has bound
      // before — user cancelling the platform prompt, a network error):
      // no vínculo created, no block, login already succeeded and stands.
      // device-link-prompt.tsx renders 'failed' as a neutral InfoBanner, not
      // an ErrorBanner — this is expected to happen constantly and isn't a
      // real error from the person's point of view.
      setOfferState('failed');
    }
  }, [scheduleTimers, setBinding]);

  const dismissOffer = useCallback(() => setOfferState('hidden'), []);

  // Gatilho 1 (RULE-DEV-06) — app-shell.tsx's "Sair" button calls this
  // before AuthProvider.logout() clears the client-side session.
  const checkoutBeforeLogout = useCallback(async () => {
    if (!activeBindingRef.current) return;
    await performCheckout('logout');
  }, [performCheckout]);

  return { activeBinding, offerState, bindThisDevice, dismissOffer, checkoutBeforeLogout };
}
