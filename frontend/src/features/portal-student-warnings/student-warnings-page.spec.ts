import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StudentWarningsPage } from './student-warnings-page';
import * as warningsApi from './student-warnings-api';

// Test page component for student warnings (RULE-FREQ-04 items 1/2, RULE-FREQ-08.3).
// This page is the "área de avisos" shown exclusively to students — the only
// surface in the system where attendance frequency warnings appear.
describe('StudentWarningsPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
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
});
