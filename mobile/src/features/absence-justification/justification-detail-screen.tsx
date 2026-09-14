import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { ScreenContainer } from '../../components/screen-container';
import { errorMessage } from '../../lib/api-client';
import { formatDateTime } from '../../lib/format-date';
import { listMySchedule } from '../schedule/schedule-api';
import {
  cancelAbsenceJustification,
  ITEM_STATUS_BADGE,
  LEGAL_CATEGORY_LABELS,
  listAbsenceJustificationAttachmentAccessLog,
  listAbsenceJustificationItems,
  listMyAbsenceJustifications,
  type AbsenceJustificationAttachmentAccessResult,
  type AbsenceJustificationItem,
} from './absence-justification-api';
import { StatusBadge } from './status-badge';
import { useAttachmentViewer } from './use-attachment-viewer';

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

const ACCESS_RESULT_LABEL: Record<AbsenceJustificationAttachmentAccessResult, string> = {
  granted: 'Access granted',
  denied: 'Access denied',
  deleted_unavailable: 'Attempt after the file was eliminated',
};

// Aluno-only screen, reached from "My justification requests" — RULE-JUST-06 (per-item status,
// decision can be partial), RULE-JUST-05.4 (cancel only while nothing was decided yet),
// RULE-JUST-11.4 (titular always sees the attachment and its access log). There is no
// GET /:submissionId endpoint on the backend — the submission's own fields (period/category/
// description) are resolved here from the already-fetched "mine" list, same
// join-two-already-existing-lists pattern the web dashboard's justification-detail-page.tsx uses.
export function JustificationDetailScreen({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: submissions } = useQuery({ queryKey: ['my-justifications'], queryFn: listMyAbsenceJustifications });
  const submission = submissions?.find((entry) => entry.id === submissionId);

  const {
    data: items,
    isLoading: itemsLoading,
    error: itemsError,
  } = useQuery({ queryKey: ['justification-items', submissionId], queryFn: () => listAbsenceJustificationItems(submissionId) });

  const { data: accessLog } = useQuery({
    queryKey: ['justification-attachment-access-log', submissionId],
    queryFn: () => listAbsenceJustificationAttachmentAccessLog(submissionId),
    // RULE-JUST-11.2: opening this list is itself an access attempt against the attachment's
    // metadata, but NOT against its bytes — no need to gate this behind an explicit tap, unlike
    // the "View attachment" action below.
    retry: false,
  });

  const { data: schedule } = useQuery({ queryKey: ['my-schedule'], queryFn: listMySchedule });
  const sessionLabelBySessionId = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of schedule ?? []) {
      map.set(entry.classSessionId, `${entry.subjectName} — ${formatDateTime(entry.scheduledStart)}`);
    }
    return map;
  }, [schedule]);

  const cancelMutation = useMutation({
    mutationFn: () => cancelAbsenceJustification(submissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['justification-items', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['my-justifications'] });
    },
  });

  const { isViewing, viewError, viewAttachment } = useAttachmentViewer(submissionId, () =>
    queryClient.invalidateQueries({ queryKey: ['justification-attachment-access-log', submissionId] }),
  );

  // RULE-JUST-05.4: cancelling is only possible while NO item has been decided yet — mirrors the
  // backend's own guard (AbsenceJustificationSubmissionService.cancel), here only used to decide
  // whether to SHOW the button (the backend is the actual enforcer).
  const canCancel = (items ?? []).length > 0 && (items ?? []).every((item: AbsenceJustificationItem) => item.status === 'under_review');

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>← Back to my requests</Text>
        </Pressable>

        <Text style={styles.title}>Request details</Text>

        {submission && (
          <View style={styles.card}>
            <Text style={styles.cardDates}>
              {submission.startDate === submission.endDate
                ? formatDateOnly(submission.startDate)
                : `${formatDateOnly(submission.startDate)} to ${formatDateOnly(submission.endDate)}`}
            </Text>
            <Text style={styles.cardCategory}>{LEGAL_CATEGORY_LABELS[submission.legalCategory]}</Text>
            <Text style={styles.cardDescription}>{submission.description}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Attachment</Text>
        {viewError && <ErrorBanner message={viewError} />}
        <Pressable style={styles.viewButton} onPress={viewAttachment} disabled={isViewing}>
          {isViewing ? <ActivityIndicator /> : <Text style={styles.viewButtonText}>View attachment</Text>}
        </Pressable>
        <Text style={styles.hint}>
          Document submitted by you — the system does not verify its authenticity. Verification is the subject's
          teacher's own act of deciding the request.
        </Text>

        {accessLog && accessLog.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Who accessed this attachment</Text>
            <Text style={styles.hint}>
              Every access is logged, including denied attempts and your own accesses (RULE-JUST-11.4).
            </Text>
            {accessLog.map((entry) => (
              <Text key={entry.id} style={styles.accessLogRow}>
                {formatDateTime(entry.occurredAt)} — {ACCESS_RESULT_LABEL[entry.accessResult]}
              </Text>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Classes in this request</Text>
        {itemsLoading && <Loading />}
        {itemsError && <ErrorBanner message={errorMessage(itemsError)} />}
        {items && items.length === 0 && <Text style={styles.hint}>No classes in this request.</Text>}
        {(items ?? []).map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemLabel}>{sessionLabelBySessionId.get(item.classSessionId) ?? `Class ${item.classSessionId}`}</Text>
            <StatusBadge label={ITEM_STATUS_BADGE[item.status].label} tone={ITEM_STATUS_BADGE[item.status].tone} />
          </View>
        ))}

        {canCancel && (
          <>
            <Text style={styles.sectionTitle}>Cancel request</Text>
            {cancelMutation.isError && <ErrorBanner message={errorMessage(cancelMutation.error)} />}
            <Text style={styles.hint}>
              Only possible while no class in this request has been decided yet. Once cancelled, it cannot be
              reopened — a new request would be needed.
            </Text>
            <Pressable
              style={styles.cancelButton}
              disabled={cancelMutation.isPending}
              onPress={() => cancelMutation.mutate(undefined, { onSuccess: () => router.replace('/justifications') })}
            >
              {cancelMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.cancelButtonText}>Cancel request</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
    gap: 4,
  },
  backLink: {
    color: '#208aef',
    fontWeight: '600',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 4,
  },
  cardDates: {
    fontWeight: '700',
  },
  cardCategory: {
    color: '#333',
    fontSize: 13,
  },
  cardDescription: {
    color: '#555',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 4,
  },
  hint: {
    color: '#777',
    fontSize: 12,
    marginBottom: 8,
  },
  viewButton: {
    borderWidth: 1,
    borderColor: '#208aef',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
  },
  viewButtonText: {
    color: '#208aef',
    fontWeight: '600',
  },
  accessLogRow: {
    color: '#555',
    fontSize: 12,
    paddingVertical: 2,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemLabel: {
    color: '#333',
    flexShrink: 1,
    marginRight: 8,
  },
  cancelButton: {
    backgroundColor: '#b02a37',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
