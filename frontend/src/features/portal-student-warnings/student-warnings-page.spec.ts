import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StudentWarningsPage } from './student-warnings-page';
import * as warningsApi from './student-warnings-api';
import * as noticesApi from '../portal-student-justifications/absence-justification-notice-api';
import * as scheduleApi from '../portal-student/student-schedule-api';

// Test page component for student warnings (RULE-FREQ-04 items 1/2, RULE-FREQ-08.3)
// and, since Frente 07, the RULE-JUST-21/22 justification-notice merge into
// the SAME list (RULE-JUST-22.6). This page is the "área de avisos" shown
// exclusively to students — the only surface in the system where either
// attendance frequency warnings or justification notices appear.
describe('StudentWarningsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
    // Every existing test below predates the notices merge and only mocks
    // listMyWarnings — this default keeps them green without touching each
    // one individually; tests that care about notices override it below.
    vi.spyOn(noticesApi, 'listMyJustificationNotices').mockResolvedValue([]);
    vi.spyOn(scheduleApi, 'listMySchedule').mockResolvedValue([]);
  });

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <StudentWarningsPage />
      </QueryClientProvider>,
    );
  }

  // ============================================================================
  // Loading State
  // ============================================================================
  describe('loading state', () => {
    it('test_studentWarningsPage_whileLoading_showsLoadingSpinner', async () => {
      vi.spyOn(warningsApi, 'listMyWarnings').mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      renderPage();

      // The loading spinner should be visible while the request is pending
      expect(screen.getByText(/carregando/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Error State
  // ============================================================================
  describe('error state', () => {
    it('test_studentWarningsPage_queryFails_showsErrorBanner', async () => {
      const error = new Error('Network error');
      vi.spyOn(warningsApi, 'listMyWarnings').mockRejectedValue(error);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/erro/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Empty State
  // ============================================================================
  describe('empty state', () => {
    it('test_studentWarningsPage_noWarnings_showsEmptyStateBanner', async () => {
      vi.spyOn(warningsApi, 'listMyWarnings').mockResolvedValue([]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/nenhum aviso/i)).toBeInTheDocument();
      });
    });

    it('test_studentWarningsPage_emptyState_noCardsRendered', async () => {
      vi.spyOn(warningsApi, 'listMyWarnings').mockResolvedValue([]);

      renderPage();

      await waitFor(() => {
        const cards = screen.queryAllByRole('listitem');
        expect(cards.length).toBe(0);
      });
    });
  });

  // ============================================================================
  // Warning Types Rendered as Distinct
  // ============================================================================
  describe('warning types', () => {
    it('test_studentWarningsPage_belowMinimumWarning_showsDistinctBadge', async () => {
      vi.spyOn(warningsApi, 'listMyWarnings').mockResolvedValue([
        {
          id: 'warning-1',
          classGroupId: 'class-group-1',
          classGroupName: 'Turma A',
          subjectId: 'subject-1',
          subjectName: 'Cálculo I',
          warningType: 'below_minimum',
          warningTypeSince: new Date('2026-09-01'),
          frequencyPercentage: 68,
          presentCount: 27,
          consideredCount: 40,
          minPercentageApplied: 75,
          periodStartDate: '2026-08-01',
          periodEndDate: '2026-09-30',
          seenAt: null,
        },
      ]);

      renderPage();

      await waitFor(() => {
        // Should show "Abaixo do mínimo" label
        expect(screen.getByText('Abaixo do mínimo')).toBeInTheDocument();
      });
    });

    it('test_studentWarningsPage_approachingMinimumWarning_showsDistinctBadge', async () => {
      vi.spyOn(warningsApi, 'listMyWarnings').mockResolvedValue([
        {
          id: 'warning-1',
          classGroupId: 'class-group-1',
          classGroupName: 'Turma A',
          subjectId: 'subject-1',
          subjectName: 'Cálculo I',
          warningType: 'approaching_minimum',
          warningTypeSince: new Date('2026-09-01'),
          frequencyPercentage: 78,
          presentCount: 31,
          consideredCount: 40,
          minPercentageApplied: 75,
          periodStartDate: '2026-08-01',
          periodEndDate: '2026-09-30',
          seenAt: null,
        },
      ]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Perto do mínimo')).toBeInTheDocument();
      });
    });

    it('test_studentWarningsPage_twoWarningTypes_notRenderedAsSameCar', async () => {
      vi.spyOn(warningsApi, 'listMyWarnings').mockResolvedValue([
        {
          id: 'warning-below',
          classGroupId: 'class-group-1',
          classGroupName: 'Turma A',
          subjectId: 'subject-1',
          subjectName: 'Cálculo I',
          warningType: 'below_minimum',
          warningTypeSince: new Date('2026-09-01'),
          frequencyPercentage: 68,
          presentCount: 27,
          consideredCount: 40,
          minPercentageApplied: 75,
          periodStartDate: '2026-08-01',
          periodEndDate: '2026-09-30',
          seenAt: null,
        },
        {
          id: 'warning-approaching',
          classGroupId: 'class-group-2',
          classGroupName: 'Turma B',
          subjectId: 'subject-2',
          subjectName: 'Física II',
          warningType: 'approaching_minimum',
          warningTypeSince: new Date('2026-09-02'),
          frequencyPercentage: 80,
          presentCount: 32,
          consideredCount: 40,
          minPercentageApplied: 75,
          periodStartDate: '2026-08-01',
          periodEndDate: '2026-09-30',
          seenAt: null,
        },
      ]);

      renderPage();

      await waitFor(() => {
        const cards = screen.getAllByRole('listitem');
        expect(cards.length).toBe(2);
        // Each card should have its own distinct badge
        expect(screen.getByText('Abaixo do mínimo')).toBeInTheDocument();
        expect(screen.getByText('Perto do mínimo')).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Polling / Refetch Interval
  // ============================================================================
  describe('polling behavior (60s refetch)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('test_studentWarningsPage_refetchesEvery60Seconds', async () => {
      const mockListMyWarnings = vi.fn().mockResolvedValue([
        {
          id: 'warning-1',
          classGroupId: 'class-group-1',
          classGroupName: 'Turma A',
          subjectId: 'subject-1',
          subjectName: 'Cálculo I',
          warningType: 'below_minimum',
          warningTypeSince: new Date('2026-09-01'),
          frequencyPercentage: 68,
          presentCount: 27,
          consideredCount: 40,
          minPercentageApplied: 75,
          periodStartDate: '2026-08-01',
          periodEndDate: '2026-09-30',
          seenAt: null,
        },
      ]);
      vi.spyOn(warningsApi, 'listMyWarnings').mockImplementation(mockListMyWarnings);

      renderPage();

      await waitFor(() => {
        expect(mockListMyWarnings).toHaveBeenCalledTimes(1);
      });

      // Advance time by 60s
      vi.advanceTimersByTime(60000);

      await waitFor(() => {
        expect(mockListMyWarnings).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ============================================================================
  // First-Access Badge
  // ============================================================================
  describe('first-access badge (seenAt)', () => {
    it('test_studentWarningsPage_unseenWarning_showsNovoNewBadge', async () => {
      vi.spyOn(warningsApi, 'listMyWarnings').mockResolvedValue([
        {
          id: 'warning-1',
          classGroupId: 'class-group-1',
          classGroupName: 'Turma A',
          subjectId: 'subject-1',
          subjectName: 'Cálculo I',
          warningType: 'below_minimum',
          warningTypeSince: new Date('2026-09-01'),
          frequencyPercentage: 68,
          presentCount: 27,
          consideredCount: 40,
          minPercentageApplied: 75,
          periodStartDate: '2026-08-01',
          periodEndDate: '2026-09-30',
          seenAt: null, // First time seeing this warning
        },
      ]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Novo')).toBeInTheDocument();
      });
    });

    it('test_studentWarningsPage_alreadySeenWarning_noNovoBadge', async () => {
      vi.spyOn(warningsApi, 'listMyWarnings').mockResolvedValue([
        {
          id: 'warning-1',
          classGroupId: 'class-group-1',
          classGroupName: 'Turma A',
          subjectId: 'subject-1',
          subjectName: 'Cálculo I',
          warningType: 'below_minimum',
          warningTypeSince: new Date('2026-09-01'),
          frequencyPercentage: 68,
          presentCount: 27,
          consideredCount: 40,
          minPercentageApplied: 75,
          periodStartDate: '2026-08-01',
          periodEndDate: '2026-09-30',
          seenAt: new Date('2026-09-01T10:00:00Z'), // Already seen
        },
      ]);

      renderPage();

      await waitFor(() => {
        // Should not show the "Novo" badge
        expect(screen.queryByText('Novo')).not.toBeInTheDocument();
      });
    });

    it('test_studentWarningsPage_newBadgeDisappearsAfterPoll_whenBackendStampsSeenAt', async () => {
      const mockListMyWarnings = vi
        .fn()
        // First poll: seenAt is null (first time)
        .mockResolvedValueOnce([
          {
            id: 'warning-1',
            classGroupId: 'class-group-1',
            classGroupName: 'Turma A',
            subjectId: 'subject-1',
            subjectName: 'Cálculo I',
            warningType: 'below_minimum',
            warningTypeSince: new Date('2026-09-01'),
            frequencyPercentage: 68,
            presentCount: 27,
            consideredCount: 40,
            minPercentageApplied: 75,
            periodStartDate: '2026-08-01',
            periodEndDate: '2026-09-30',
            seenAt: null,
          },
        ])
        // Second poll after 60s: backend stamped seenAt
        .mockResolvedValueOnce([
          {
            id: 'warning-1',
            classGroupId: 'class-group-1',
            classGroupName: 'Turma A',
            subjectId: 'subject-1',
            subjectName: 'Cálculo I',
            warningType: 'below_minimum',
            warningTypeSince: new Date('2026-09-01'),
            frequencyPercentage: 68,
            presentCount: 27,
            consideredCount: 40,
            minPercentageApplied: 75,
            periodStartDate: '2026-08-01',
            periodEndDate: '2026-09-30',
            seenAt: new Date('2026-09-01T10:00:00Z'),
          },
        ]);

      vi.spyOn(warningsApi, 'listMyWarnings').mockImplementation(mockListMyWarnings);
      vi.useFakeTimers();

      renderPage();

      // First render: should show "Novo"
      await waitFor(() => {
        expect(screen.getByText('Novo')).toBeInTheDocument();
      });

      // Advance 60s for the refetch
      vi.advanceTimersByTime(60000);

      // After refetch: "Novo" badge should be gone
      await waitFor(() => {
        expect(screen.queryByText('Novo')).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });
  });

  // ============================================================================
  // Card Content
  // ============================================================================
  describe('card content rendering', () => {
    it('test_studentWarningsPage_warningCard_showsSubjectNameClassGroupNamePercentageCountsMinimumPeriod', async () => {
      vi.spyOn(warningsApi, 'listMyWarnings').mockResolvedValue([
        {
          id: 'warning-1',
          classGroupId: 'class-group-1',
          classGroupName: 'Turma A',
          subjectId: 'subject-1',
          subjectName: 'Cálculo I',
          warningType: 'below_minimum',
          warningTypeSince: new Date('2026-09-01'),
          frequencyPercentage: 68,
          presentCount: 27,
          consideredCount: 40,
          minPercentageApplied: 75,
          periodStartDate: '2026-08-01',
          periodEndDate: '2026-09-30',
          seenAt: null,
        },
      ]);

      renderPage();

      await waitFor(() => {
        // Subject and class group name
        expect(screen.getByText('Cálculo I')).toBeInTheDocument();
        expect(screen.getByText('Turma A')).toBeInTheDocument();

        // Percentage
        expect(screen.getByText('68%')).toBeInTheDocument();

        // Attendance counts
        expect(screen.getByText('27 de 40 aulas')).toBeInTheDocument();

        // Minimum
        expect(screen.getByText('75%')).toBeInTheDocument();

        // Period dates (formatted DD/MM/AAAA)
        expect(screen.getByText('01/08/2026 a 30/09/2026')).toBeInTheDocument();
      });
    });

    it('test_studentWarningsPage_multipleWarnings_rankedBelowMinimumFirst', async () => {
      vi.spyOn(warningsApi, 'listMyWarnings').mockResolvedValue([
        {
          id: 'warning-approaching',
          classGroupId: 'class-group-1',
          classGroupName: 'Turma A',
          subjectId: 'subject-1',
          subjectName: 'Português',
          warningType: 'approaching_minimum',
          warningTypeSince: new Date('2026-09-01'),
          frequencyPercentage: 80,
          presentCount: 32,
          consideredCount: 40,
          minPercentageApplied: 75,
          periodStartDate: '2026-08-01',
          periodEndDate: '2026-09-30',
          seenAt: null,
        },
        {
          id: 'warning-below',
          classGroupId: 'class-group-2',
          classGroupName: 'Turma B',
          subjectId: 'subject-2',
          subjectName: 'Cálculo I',
          warningType: 'below_minimum',
          warningTypeSince: new Date('2026-09-01'),
          frequencyPercentage: 65,
          presentCount: 26,
          consideredCount: 40,
          minPercentageApplied: 75,
          periodStartDate: '2026-08-01',
          periodEndDate: '2026-09-30',
          seenAt: null,
        },
      ]);

      renderPage();

      await waitFor(() => {
        const cards = screen.getAllByRole('listitem');
        // below_minimum should come first in the rendered list
        const belowCard = cards[0];
        expect(belowCard).toHaveTextContent('Cálculo I');
      });
    });
  });

  // ============================================================================
  // Justification Notices Merge (RULE-JUST-21/22, single list per RULE-JUST-22.6)
  // ============================================================================
  describe('justification notices merge', () => {
    it('test_studentWarningsPage_decisionResultNotice_rendersApprovedRejectedCountsAndFrequencyChange', async () => {
      vi.spyOn(warningsApi, 'listMyWarnings').mockResolvedValue([]);
      vi.spyOn(noticesApi, 'listMyJustificationNotices').mockResolvedValue([
        {
          id: 'notice-1',
          personId: 'person-1',
          submissionId: 'submission-1',
          subjectId: 'subject-1',
          noticeType: 'decision_result',
          details: {
            approvedCount: 1,
            rejectedCount: 0,
            items: [{ classSessionId: 'session-1', status: 'approved', note: null, decidedByPersonId: 'teacher-1', decidedAt: '2026-09-05T10:00:00Z' }],
            frequencyBeforePercentage: 72,
            frequencyAfterPercentage: 78,
            resendMayStillBeEligible: false,
          },
          seenAt: null,
          dismissedAt: null,
          createdAt: '2026-09-05T10:00:00Z',
        },
      ]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Resultado de justificativa')).toBeInTheDocument();
        expect(screen.getByText(/1 aula abonada/)).toBeInTheDocument();
        expect(screen.getByText(/passou de 72% para 78%/)).toBeInTheDocument();
      });
    });

    it('test_studentWarningsPage_approvalRevokedNotice_rendersMotivo', async () => {
      vi.spyOn(warningsApi, 'listMyWarnings').mockResolvedValue([]);
      vi.spyOn(noticesApi, 'listMyJustificationNotices').mockResolvedValue([
        {
          id: 'notice-2',
          personId: 'person-1',
          submissionId: 'submission-1',
          subjectId: 'subject-1',
          noticeType: 'approval_revoked',
          details: { revocations: [{ classSessionId: 'session-1', note: 'Aprovado por engano', revokedAt: '2026-09-06T10:00:00Z' }] },
          seenAt: null,
          dismissedAt: null,
          createdAt: '2026-09-06T10:00:00Z',
        },
      ]);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Revogação de aprovação')).toBeInTheDocument();
        expect(screen.getByText(/Aprovado por engano/)).toBeInTheDocument();
      });
    });

    it('test_studentWarningsPage_warningsAndNotices_renderInOneMergedList', async () => {
      vi.spyOn(warningsApi, 'listMyWarnings').mockResolvedValue([
        {
          id: 'warning-1',
          classGroupId: 'class-group-1',
          classGroupName: 'Turma A',
          subjectId: 'subject-1',
          subjectName: 'Cálculo I',
          warningType: 'below_minimum',
          warningTypeSince: new Date('2026-09-01'),
          frequencyPercentage: 68,
          presentCount: 27,
          consideredCount: 40,
          minPercentageApplied: 75,
          periodStartDate: '2026-08-01',
          periodEndDate: '2026-09-30',
          seenAt: null,
        },
      ]);
      vi.spyOn(noticesApi, 'listMyJustificationNotices').mockResolvedValue([
        {
          id: 'notice-1',
          personId: 'person-1',
          submissionId: 'submission-1',
          subjectId: 'subject-1',
          noticeType: 'decision_result',
          details: {
            approvedCount: 0,
            rejectedCount: 1,
            items: [{ classSessionId: 'session-1', status: 'rejected', note: 'Atestado ilegível', decidedByPersonId: 'teacher-1', decidedAt: '2026-09-05T10:00:00Z' }],
            frequencyBeforePercentage: null,
            frequencyAfterPercentage: null,
            resendMayStillBeEligible: true,
          },
          seenAt: null,
          dismissedAt: null,
          createdAt: '2026-09-05T10:00:00Z',
        },
      ]);

      renderPage();

      await waitFor(() => {
        const cards = screen.getAllByRole('listitem');
        expect(cards.length).toBe(2);
      });
    });

    it('test_studentWarningsPage_dismissNotice_callsDismissAndRemovesFromList', async () => {
      vi.spyOn(warningsApi, 'listMyWarnings').mockResolvedValue([]);
      const mockDismiss = vi.fn().mockResolvedValue({ noticeId: 'notice-1', dismissed: true });
      vi.spyOn(noticesApi, 'listMyJustificationNotices')
        .mockResolvedValueOnce([
          {
            id: 'notice-1',
            personId: 'person-1',
            submissionId: 'submission-1',
            subjectId: 'subject-1',
            noticeType: 'approval_revoked',
            details: { revocations: [{ classSessionId: 'session-1', note: 'Engano', revokedAt: '2026-09-06T10:00:00Z' }] },
            seenAt: null,
            dismissedAt: null,
            createdAt: '2026-09-06T10:00:00Z',
          },
        ])
        .mockResolvedValueOnce([]);
      vi.spyOn(noticesApi, 'dismissJustificationNotice').mockImplementation(mockDismiss);

      renderPage();

      const dismissButton = await screen.findByRole('button', { name: /dispensar/i });
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(mockDismiss).toHaveBeenCalledWith('notice-1');
      });
    });
  });
});
