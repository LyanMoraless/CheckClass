import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TeachingClassGroupsPage } from './teaching-class-groups-page';
import * as teachingClassGroupsApi from './teaching-class-groups-api';
import * as scheduleApi from '../portal-student/student-schedule-api';
import * as headcountAlertApi from './class-session-headcount-alert-api';
import type { TeachingClassGroupEntry } from './teaching-class-groups-api';
import type { StudentScheduleEntry } from '../portal-student/student-schedule-api';

// RULE-PRES-10/11 (Bloco 4): "Aula agora" is this screen's own addition for
// the Fluxo de Chamada Redesenhado — a column that only ever appears when
// GET /v1/me/schedule says a session of that turma is in andamento right
// now, opening HeadcountAlertModal for that exact classSessionId. Reuses
// this existing "Minhas turmas" screen rather than a new isolated nav entry
// (see Frontend Implementation Summary for the rationale).
describe('TeachingClassGroupsPage', () => {
  let queryClient: QueryClient;

  const classGroup: TeachingClassGroupEntry = {
    classGroupId: 'class-group-1',
    classGroupName: 'Turma A',
    subjectNames: ['Cálculo I'],
    courseName: 'Engenharia',
  };

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();
    vi.spyOn(teachingClassGroupsApi, 'listMyTeachingClassGroups').mockResolvedValue([classGroup]);
    vi.spyOn(scheduleApi, 'listMySchedule').mockResolvedValue([]);
  });

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TeachingClassGroupsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  function scheduleEntry(overrides: Partial<StudentScheduleEntry> = {}): StudentScheduleEntry {
    return {
      classSessionId: 'session-1',
      classGroupId: 'class-group-1',
      classGroupName: 'Turma A',
      subjectName: 'Cálculo I',
      roomId: 'room-1',
      roomName: 'Sala 1',
      scheduledStart: '2026-09-17T10:00:00.000Z',
      scheduledEnd: '2026-09-17T12:00:00.000Z',
      status: 'scheduled',
      ...overrides,
    };
  }

  it('test_teachingClassGroupsPage_noInProgressSession_showsDashInAulaAgoraColumn', async () => {
    vi.spyOn(scheduleApi, 'listMySchedule').mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Turma A')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /ver contagem/i })).not.toBeInTheDocument();
  });

  it('test_teachingClassGroupsPage_sessionScheduledButNotStarted_noAulaAgoraButton', async () => {
    vi.spyOn(scheduleApi, 'listMySchedule').mockResolvedValue([
      scheduleEntry({
        scheduledStart: '2999-01-01T10:00:00.000Z',
        scheduledEnd: '2999-01-01T12:00:00.000Z',
      }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Turma A')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /ver contagem/i })).not.toBeInTheDocument();
  });

  it('test_teachingClassGroupsPage_cancelledSessionCoveringNow_noAulaAgoraButton', async () => {
    const now = new Date();
    vi.spyOn(scheduleApi, 'listMySchedule').mockResolvedValue([
      scheduleEntry({
        scheduledStart: new Date(now.getTime() - 60 * 60000).toISOString(),
        scheduledEnd: new Date(now.getTime() + 60 * 60000).toISOString(),
        status: 'cancelled',
      }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Turma A')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /ver contagem/i })).not.toBeInTheDocument();
  });

  it('test_teachingClassGroupsPage_sessionInProgress_showsAulaAgoraButton', async () => {
    const now = new Date();
    vi.spyOn(scheduleApi, 'listMySchedule').mockResolvedValue([
      scheduleEntry({
        scheduledStart: new Date(now.getTime() - 30 * 60000).toISOString(),
        scheduledEnd: new Date(now.getTime() + 30 * 60000).toISOString(),
        status: 'scheduled',
      }),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ver contagem/i })).toBeInTheDocument();
    });
  });

  it('test_teachingClassGroupsPage_clickAulaAgora_opensModalWithMatchingSessionId', async () => {
    const now = new Date();
    vi.spyOn(scheduleApi, 'listMySchedule').mockResolvedValue([
      scheduleEntry({
        classSessionId: 'session-in-progress',
        scheduledStart: new Date(now.getTime() - 30 * 60000).toISOString(),
        scheduledEnd: new Date(now.getTime() + 30 * 60000).toISOString(),
      }),
    ]);
    const getAlert = vi.spyOn(headcountAlertApi, 'getClassSessionHeadcountAlert').mockResolvedValue({
      classSessionId: 'session-in-progress',
      inProgress: true,
      roomId: 'room-1',
      windows: [],
      alertActive: false,
    });

    renderPage();

    const button = await screen.findByRole('button', { name: /ver contagem/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(getAlert).toHaveBeenCalledWith('session-in-progress');
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
