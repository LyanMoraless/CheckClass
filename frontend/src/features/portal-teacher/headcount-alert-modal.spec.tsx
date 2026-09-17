import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HeadcountAlertModal } from './headcount-alert-modal';
import * as headcountAlertApi from './class-session-headcount-alert-api';
import type { ClassroomHeadcountAlert } from './class-session-headcount-alert-api';

// RULE-PRES-10/11 (Bloco 4 — Contagem por câmera como cruzamento). This
// component is a read-only mirror of ClassroomHeadcountReconciliationResult
// (backend) — every test below exercises one of the shapes that interface's
// own comments call out as a legitimate, non-error state (inProgress: false,
// empty windows, a single unconfirmed window), plus alertActive true/false,
// never a "resolve"/"confirm presence" action (there is none to test).
describe('HeadcountAlertModal', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();
  });

  function renderModal(classSessionId = 'session-1') {
    return render(
      <QueryClientProvider client={queryClient}>
        <HeadcountAlertModal classSessionId={classSessionId} classGroupName="Turma A" onClose={vi.fn()} />
      </QueryClientProvider>,
    );
  }

  function alert(overrides: Partial<ClassroomHeadcountAlert> = {}): ClassroomHeadcountAlert {
    return {
      classSessionId: 'session-1',
      inProgress: true,
      roomId: 'room-1',
      windows: [],
      alertActive: false,
      ...overrides,
    };
  }

  it('test_headcountAlertModal_whileLoading_showsLoadingSpinner', () => {
    vi.spyOn(headcountAlertApi, 'getClassSessionHeadcountAlert').mockImplementation(() => new Promise(() => {}));

    renderModal();

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('test_headcountAlertModal_queryFails_showsErrorBanner', async () => {
    vi.spyOn(headcountAlertApi, 'getClassSessionHeadcountAlert').mockRejectedValue(new Error('Network error'));

    renderModal();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('test_headcountAlertModal_notInProgress_showsInfoBannerNotError', async () => {
    vi.spyOn(headcountAlertApi, 'getClassSessionHeadcountAlert').mockResolvedValue(alert({ inProgress: false, roomId: null }));

    renderModal();

    await waitFor(() => {
      expect(screen.getByText(/não está em andamento/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('test_headcountAlertModal_inProgressNoWindowsYet_showsInfoBannerNotError', async () => {
    vi.spyOn(headcountAlertApi, 'getClassSessionHeadcountAlert').mockResolvedValue(alert({ inProgress: true, windows: [] }));

    renderModal();

    await waitFor(() => {
      expect(screen.getByText(/não há leituras de câmera suficientes/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('test_headcountAlertModal_singleWindow_showsThreeNumbersAndUnconfirmedNotice', async () => {
    vi.spyOn(headcountAlertApi, 'getClassSessionHeadcountAlert').mockResolvedValue(
      alert({
        windows: [
          {
            capturedAt: '2026-09-17T10:00:00.000Z',
            cameraCount: 27,
            appCheckinCount: 30,
            roomPresenceCount: 30,
            maxDivergence: 3,
          },
        ],
        alertActive: false,
      }),
    );

    renderModal();

    await waitFor(() => {
      expect(screen.getByText('27')).toBeInTheDocument();
      expect(screen.getAllByText('30')).toHaveLength(2);
      expect(screen.getByText(/exige duas leituras seguidas/i)).toBeInTheDocument();
      expect(screen.getByText('Sem divergência confirmada')).toBeInTheDocument();
    });
  });

  it('test_headcountAlertModal_twoWindowsAlertActive_showsBothWindowsAndDangerBadge', async () => {
    vi.spyOn(headcountAlertApi, 'getClassSessionHeadcountAlert').mockResolvedValue(
      alert({
        windows: [
          {
            capturedAt: '2026-09-17T10:15:00.000Z',
            cameraCount: 20,
            appCheckinCount: 30,
            roomPresenceCount: 30,
            maxDivergence: 10,
          },
          {
            capturedAt: '2026-09-17T10:00:00.000Z',
            cameraCount: 21,
            appCheckinCount: 30,
            roomPresenceCount: 29,
            maxDivergence: 9,
          },
        ],
        alertActive: true,
      }),
    );

    renderModal();

    await waitFor(() => {
      expect(screen.getByText('Divergência confirmada')).toBeInTheDocument();
      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText('21')).toBeInTheDocument();
    });
    expect(screen.queryByText(/exige duas leituras seguidas/i)).not.toBeInTheDocument();
  });

  it('test_headcountAlertModal_closeButton_callsOnClose', async () => {
    vi.spyOn(headcountAlertApi, 'getClassSessionHeadcountAlert').mockResolvedValue(alert({ inProgress: false, roomId: null }));
    const onClose = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <HeadcountAlertModal classSessionId="session-1" classGroupName="Turma A" onClose={onClose} />
      </QueryClientProvider>,
    );

    const closeButton = await screen.findByRole('button', { name: /fechar/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('test_headcountAlertModal_noResolveOrConfirmAction_isNeverRendered', async () => {
    // RULE-PRES-10: a chamada manual do professor está sempre fora deste
    // painel — este teste protege contra a reintrodução acidental de um
    // botão de "resolver"/"confirmar presença" aqui.
    vi.spyOn(headcountAlertApi, 'getClassSessionHeadcountAlert').mockResolvedValue(
      alert({
        windows: [
          {
            capturedAt: '2026-09-17T10:00:00.000Z',
            cameraCount: 20,
            appCheckinCount: 30,
            roomPresenceCount: 30,
            maxDivergence: 10,
          },
        ],
      }),
    );

    renderModal();

    await waitFor(() => {
      expect(screen.getByText('20')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /resolver/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmar presença/i })).not.toBeInTheDocument();
  });
});
