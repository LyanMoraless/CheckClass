import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DeviceBindingSession } from './use-device-binding-session';
import { DeviceLinkPrompt } from './device-link-prompt';

// NOTE (Testing Agent, 2026-09-11): same non-executable-today caveat as
// use-device-binding-session.spec.ts — vitest/@testing-library/react are not
// installed yet (pre-existing gap). Written as typed documentation of the
// component's state-to-UI mapping, not run.
//
// This is a pure state->UI mapping (use-device-binding-session.ts already
// decided WHEN each state applies) — covers every one of BindOfferState's six
// values, including the two that must render nothing at all (RULE-DEV-02/
// GAP-09's "sem UI nenhuma, sem erro, sem aviso" for 'checking'/'hidden') and
// the InfoBanner-not-ErrorBanner posture for 'failed' (architecture-overview.md
// item 3's UX convention).
describe('DeviceLinkPrompt', () => {
  function buildSession(overrides: Partial<DeviceBindingSession> = {}): DeviceBindingSession {
    return {
      activeBinding: null,
      offerState: 'offering',
      bindThisDevice: vi.fn(),
      dismissOffer: vi.fn(),
      checkoutBeforeLogout: vi.fn(),
      ...overrides,
    };
  }

  it('test_offerStateChecking_rendersNothing', () => {
    const { container } = render(<DeviceLinkPrompt {...buildSession({ offerState: 'checking' })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('test_offerStateHidden_rendersNothing', () => {
    const { container } = render(<DeviceLinkPrompt {...buildSession({ offerState: 'hidden' })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('test_offerStateOffering_rendersBannerWithEnabledBindButton', () => {
    const session = buildSession({ offerState: 'offering' });
    render(<DeviceLinkPrompt {...session} />);

    const bindButton = screen.getByRole('button', { name: /Vincular dispositivo/i });
    expect(bindButton).not.toBeDisabled();

    fireEvent.click(bindButton);
    expect(session.bindThisDevice).toHaveBeenCalled();
  });

  it('test_offerStateBinding_disablesBothButtonsAndShowsProgressLabel', () => {
    render(<DeviceLinkPrompt {...buildSession({ offerState: 'binding' })} />);

    expect(screen.getByRole('button', { name: /Vinculando…/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Agora não/i })).toBeDisabled();
  });

  it('test_offerStateBound_rendersInfoBannerNotErrorBanner', () => {
    const session = buildSession({ offerState: 'bound' });
    render(<DeviceLinkPrompt {...session} />);

    expect(screen.getByText(/Dispositivo vinculado a esta sessão/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ok/i }));
    expect(session.dismissOffer).toHaveBeenCalled();
  });

  // architecture-overview.md item 3: an ambient offer's failure is neutral
  // (InfoBanner), never alarming (ErrorBanner) — this is the expected common
  // case (no enrolled credential yet), not a real error from the person's PoV.
  it('test_offerStateFailed_rendersNeutralInfoBannerNotError', () => {
    const session = buildSession({ offerState: 'failed' });
    render(<DeviceLinkPrompt {...session} />);

    expect(screen.getByText(/Não foi possível vincular este dispositivo agora/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Fechar/i }));
    expect(session.dismissOffer).toHaveBeenCalled();
  });
});
