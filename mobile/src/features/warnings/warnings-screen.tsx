import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { ScreenContainer } from '../../components/screen-container';
import { errorMessage } from '../../lib/api-client';
import { formatDateTime } from '../../lib/format-date';
import { listMySchedule } from '../schedule/schedule-api';
import { buildWarningsFeed, resolveNoticeSubjectLabel, type FeedEntry } from './warnings-feed';
import {
  dismissJustificationNotice,
  listMyJustificationNotices,
  listMyWarnings,
  type AbsenceJustificationApprovalRevokedDetails,
  type AbsenceJustificationDecisionResultDetails,
  type AbsenceJustificationNotice,
  type ActiveWarningEntry,
} from './warnings-api';

// LOAD PARAMETER, NOT A UX KNOB. Every poll of GET /v1/me/warnings makes
// FrequencyWarningReadService run LAZY RECONCILIATION first — there is no
// scheduler/cron/queue anywhere in this project, so this poll IS the only
// thing that keeps a student's accumulated frequency current. 60s is the
// approved cost for that endpoint (see student-warnings-page.tsx on the web
// dashboard for the full rationale) — do not shorten it without revisiting
// that architecture decision.
//
// RULE-JUST-22 notices are read-model events, not a recomputed number, so
// nothing about them requires this exact interval — reusing it for
// GET /v1/absence-justification-notices too is a simplicity choice (one poll
// cadence for the whole "área de avisos"), not a cost constraint on that
// endpoint's own account.
const WARNINGS_POLL_INTERVAL_MS = 60000;

const WARNING_TYPE_LABEL: Record<ActiveWarningEntry['warningType'], string> = {
  approaching_minimum: 'Approaching minimum',
  below_minimum: 'Below minimum',
};

const NOTICE_TYPE_LABEL: Record<AbsenceJustificationNotice['noticeType'], string> = {
  decision_result: 'Justification decision',
  approval_revoked: 'Approval revoked',
};

// Aviso da home do aluno (RULE-FREQ-04 item 2), extended by RULE-JUST-21/22
// to carry a second, unrelated event type (justification decision
// results/revocations) in the SAME list — native port of the web dashboard's
// student-warnings-page.tsx.
export function WarningsScreen() {
  const {
    data: warnings,
    isLoading: warningsLoading,
    isRefetching: warningsRefetching,
    error: warningsError,
    refetch: refetchWarnings,
  } = useQuery({
    queryKey: ['warnings-mine'],
    queryFn: listMyWarnings,
    refetchInterval: WARNINGS_POLL_INTERVAL_MS,
  });

  const {
    data: notices,
    isLoading: noticesLoading,
    isRefetching: noticesRefetching,
    error: noticesError,
    refetch: refetchNotices,
  } = useQuery({
    queryKey: ['justification-notices-mine'],
    queryFn: listMyJustificationNotices,
    refetchInterval: WARNINGS_POLL_INTERVAL_MS,
  });

  // Same query key as ScheduleScreen ('my-schedule') — same endpoint, same
  // data, so sharing the cache avoids a duplicate request when both tabs are
  // mounted, instead of introducing a second source of truth for it.
  const { data: schedule, refetch: refetchSchedule } = useQuery({
    queryKey: ['my-schedule'],
    queryFn: listMySchedule,
  });

  const classGroupSubjectLabelBySessionId = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of schedule ?? []) {
      map.set(entry.classSessionId, `${entry.subjectName} — ${entry.classGroupName}`);
    }
    return map;
  }, [schedule]);

  const feed = useMemo(() => buildWarningsFeed(warnings ?? [], notices ?? []), [warnings, notices]);

  const isLoading = warningsLoading || noticesLoading;
  const isRefetching = warningsRefetching || noticesRefetching;

  const handleRefresh = () => {
    refetchWarnings();
    refetchNotices();
    refetchSchedule();
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>My warnings</Text>
      <Text style={styles.hint}>
        Accumulated frequency at risk per subject, plus the outcome of absence justification requests, in a single
        list.
      </Text>
      {warningsError && <ErrorBanner message={errorMessage(warningsError)} />}
      {noticesError && <ErrorBanner message={errorMessage(noticesError)} />}
      {isLoading && <Loading />}
      <FlatList
        data={feed}
        keyExtractor={feedEntryKey}
        renderItem={({ item }) => (
          <FeedEntryCard entry={item} classGroupSubjectLabelBySessionId={classGroupSubjectLabelBySessionId} />
        )}
        onRefresh={handleRefresh}
        refreshing={isRefetching}
        ListEmptyComponent={!isLoading ? <Text style={styles.empty}>No warnings or notices right now.</Text> : null}
      />
    </ScreenContainer>
  );
}

function feedEntryKey(entry: FeedEntry): string {
  return entry.kind === 'frequency' ? `warning-${entry.warning.id}` : `notice-${entry.notice.id}`;
}

function FeedEntryCard({ entry, classGroupSubjectLabelBySessionId }: { entry: FeedEntry; classGroupSubjectLabelBySessionId: Map<string, string> }) {
  if (entry.kind === 'frequency') {
    return <WarningCard warning={entry.warning} />;
  }
  return (
    <NoticeCard notice={entry.notice} subjectLabel={resolveNoticeSubjectLabel(entry.notice, classGroupSubjectLabelBySessionId)} />
  );
}

function WarningCard({ warning }: { warning: ActiveWarningEntry }) {
  const isBelowMinimum = warning.warningType === 'below_minimum';
  return (
    <View style={[styles.card, isBelowMinimum ? styles.cardBelow : styles.cardApproaching]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeading}>
          <Text style={styles.cardSubject}>{warning.subjectName}</Text>
          <Text style={styles.cardClassGroup}>{warning.classGroupName}</Text>
        </View>
        <View style={styles.cardBadges}>
          <Badge label="Frequency" tone="neutral" />
          <Badge label={WARNING_TYPE_LABEL[warning.warningType]} tone={isBelowMinimum ? 'danger' : 'warning'} />
          {/* seenAt null = this exact read is the first time this warning was
              ever shown to the student (RULE-FREQ-04 item 1) — disappears on
              the very next poll once the backend stamps seenAt. */}
          {warning.seenAt === null && <Badge label="New" tone="info" />}
        </View>
      </View>
      <View style={styles.cardGrid}>
        <DetailRow label="Accumulated frequency" value={`${warning.frequencyPercentage}%`} />
        <DetailRow label="Classes considered" value={`${warning.presentCount} of ${warning.consideredCount}`} />
        <DetailRow label="Minimum required this period" value={`${warning.minPercentageApplied}%`} />
        <DetailRow
          label="Assessment period"
          value={`${formatDateOnly(warning.periodStartDate)} to ${formatDateOnly(warning.periodEndDate)}`}
        />
      </View>
    </View>
  );
}

// RULE-JUST-21/22: a justification notice, rendered as its own card type —
// never sharing WarningCard's markup, since its content (approved/rejected
// counts, professor's motivo, frequency before/after) has nothing in common
// with a frequency warning's.
function NoticeCard({ notice, subjectLabel }: { notice: AbsenceJustificationNotice; subjectLabel: string | null }) {
  const queryClient = useQueryClient();
  const dismissMutation = useMutation({
    mutationFn: dismissJustificationNotice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['justification-notices-mine'] }),
  });

  const isRevocation = notice.noticeType === 'approval_revoked';
  return (
    <View style={[styles.card, isRevocation ? styles.cardBelow : styles.cardApproaching]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeading}>
          <Text style={styles.cardSubject}>{subjectLabel ?? `Subject ${notice.subjectId}`}</Text>
          <Text style={styles.cardClassGroup}>{formatDateTime(notice.createdAt)}</Text>
        </View>
        <View style={styles.cardBadges}>
          <Badge label={NOTICE_TYPE_LABEL[notice.noticeType]} tone="neutral" />
          {/* Unlike ActiveWarningEntry.seenAt, this "New" badge is purely
              informational (RULE-JUST-22.2: "não some ao ser lido"). */}
          {notice.seenAt === null && <Badge label="New" tone="info" />}
        </View>
      </View>

      {notice.noticeType === 'decision_result' ? (
        <DecisionResultBody details={notice.details as AbsenceJustificationDecisionResultDetails} />
      ) : (
        <RevocationBody details={notice.details as AbsenceJustificationApprovalRevokedDetails} />
      )}

      {dismissMutation.isError && <ErrorBanner message={errorMessage(dismissMutation.error)} />}
      <Pressable
        style={styles.dismissButton}
        onPress={() => dismissMutation.mutate(notice.id)}
        disabled={dismissMutation.isPending}
      >
        <Text style={styles.dismissButtonText}>{dismissMutation.isPending ? 'Dismissing…' : 'Dismiss'}</Text>
      </Pressable>
    </View>
  );
}

function DecisionResultBody({ details }: { details: AbsenceJustificationDecisionResultDetails }) {
  return (
    <View style={styles.cardBody}>
      <Text style={styles.cardText}>
        {details.approvedCount} {details.approvedCount === 1 ? 'class approved' : 'classes approved'},{' '}
        {details.rejectedCount} {details.rejectedCount === 1 ? 'class rejected' : 'classes rejected'}.
      </Text>
      {/* RULE-JUST-21 item 4: only present on an approval — this is the
          explanation for a frequency warning that may have just silently
          disappeared from this same list (RULE-JUST-21 item 5). */}
      {details.frequencyAfterPercentage !== null && (
        <Text style={styles.cardText}>
          Your frequency {details.frequencyBeforePercentage !== null ? `went from ${details.frequencyBeforePercentage}% ` : ''}
          to {details.frequencyAfterPercentage}%.
        </Text>
      )}
      {details.rejectedCount > 0 && (
        <Text style={styles.cardSmallText}>
          {details.resendMayStillBeEligible
            ? 'A new request for the rejected class(es) may still be possible, if the deadline allows.'
            : 'The deadline for a new request for the rejected class(es) has already passed.'}
        </Text>
      )}
      {details.items
        .filter((item) => item.status === 'rejected' && item.note)
        .map((item) => (
          <Text key={item.classSessionId} style={styles.cardSmallText}>
            Rejection reason: {item.note}
          </Text>
        ))}
    </View>
  );
}

function RevocationBody({ details }: { details: AbsenceJustificationApprovalRevokedDetails }) {
  return (
    <View style={styles.cardBody}>
      {details.revocations.map((revocation, index) => (
        <Text key={`${revocation.classSessionId}-${index}`} style={styles.cardText}>
          An approval was revoked. Reason: {revocation.note}
        </Text>
      ))}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

type BadgeTone = 'neutral' | 'warning' | 'danger' | 'info';

function Badge({ label, tone }: { label: string; tone: BadgeTone }) {
  return (
    <View style={[styles.badge, badgeToneStyles[tone]]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

// "YYYY-MM-DD" -> "DD/MM/YYYY" read as plain numbers, never through
// `new Date(...)`. These are calendar facts the backend renders verbatim for
// exactly this reason — parsing them back into a JS Date would reintroduce
// the local-midnight/UTC shift that decision exists to avoid (see
// ActiveWarningEntry.periodStartDate in warnings-api.ts).
function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

const badgeToneStyles = StyleSheet.create({
  neutral: { backgroundColor: '#e2e2e2' },
  warning: { backgroundColor: '#fff3cd' },
  danger: { backgroundColor: '#f8d7da' },
  info: { backgroundColor: '#cfe2ff' },
});

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  hint: {
    color: '#777',
    fontSize: 12,
    marginBottom: 16,
  },
  empty: {
    textAlign: 'center',
    color: '#777',
    marginTop: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  cardApproaching: {
    borderColor: '#ffe08a',
    backgroundColor: '#fffdf5',
  },
  cardBelow: {
    borderColor: '#f1aeb5',
    backgroundColor: '#fff8f8',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardHeading: {
    flex: 1,
  },
  cardSubject: {
    fontWeight: '700',
    fontSize: 15,
  },
  cardClassGroup: {
    color: '#555',
    fontSize: 12,
    marginTop: 2,
  },
  cardBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'flex-end',
  },
  cardGrid: {
    gap: 4,
  },
  cardBody: {
    gap: 4,
  },
  cardText: {
    color: '#333',
  },
  cardSmallText: {
    color: '#666',
    fontSize: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: '#666',
    fontSize: 12,
  },
  detailValue: {
    fontWeight: '600',
    fontSize: 12,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
  },
  dismissButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dismissButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
