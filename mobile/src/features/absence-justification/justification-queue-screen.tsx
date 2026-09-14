import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { ScreenContainer } from '../../components/screen-container';
import { errorMessage } from '../../lib/api-client';
import {
  decideAbsenceJustificationItem,
  ITEM_STATUS_BADGE,
  LEGAL_CATEGORY_LABELS,
  listAbsenceJustificationQueue,
  listMyDecidedAbsenceJustificationItems,
  revokeAbsenceJustificationApproval,
  type AbsenceJustificationQueueItem,
  type DecideAbsenceJustificationItemInput,
} from './absence-justification-api';
import { StatusBadge } from './status-badge';
import { useAttachmentViewer } from './use-attachment-viewer';

const QUEUE_QUERY_KEY = ['justification-queue'];
// status=approved narrows to the items RULE-JUST-17 actually lets this professor revoke — GET
// .../decided lists every decision this professor has ever made (any session, any device), not
// just the ones made earlier in the current app session.
const DECIDED_QUERY_KEY = ['justification-decided', 'approved'];

// Professor-side counterpart to my-justifications-screen.tsx (the student's own screen) — closes
// the Absence Justification feature end to end. RULE-JUST-06/08/24: only items of a (turma,
// matéria) this professor actually teaches, server-side filtered — nothing narrowed further
// here. Two sections, native port of the web dashboard's justification-queue-page.tsx: (1) the
// under_review queue to decide, (2) every approval this professor has ever granted, revocable
// per RULE-JUST-17.
//
// Unlike the web dashboard's justification-queue-row.tsx (which resolves classGroupName from
// roleContext.teaching, loaded by its AuthProvider), this screen shows raw ids for
// classGroupId/subjectId/classSessionId/personId — the mobile JWT only carries
// { personId, tenantId }, no role/actorType (see (app)/_layout.tsx's comment), and there is no
// per-role UI split to hang a name-resolution lookup on. Same limitation subjectId already has on
// the web. The "View attachment" button is always shown (no client-side permission check to
// mirror the web's hasPermission('view_absence_justification_attachment') gate, for the same
// reason) — a professor who isn't authorized simply gets a normal ErrorBanner from the backend.
export function JustificationQueueScreen() {
  const {
    data: queue,
    isLoading: isQueueLoading,
    error: queueError,
  } = useQuery({ queryKey: QUEUE_QUERY_KEY, queryFn: listAbsenceJustificationQueue });

  const {
    data: decided,
    isLoading: isDecidedLoading,
    error: decidedError,
  } = useQuery({ queryKey: DECIDED_QUERY_KEY, queryFn: () => listMyDecidedAbsenceJustificationItems('approved') });

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Justification queue</Text>
        <Text style={styles.hint}>
          Approving removes the absence (it counts as attendance, but stays identifiable as a justified absence).
          Rejecting keeps the absence and requires a written note explaining why.
        </Text>

        {queueError && <ErrorBanner message={errorMessage(queueError)} />}
        {isQueueLoading && <Loading />}
        {queue && queue.length === 0 && (
          <Text style={styles.empty}>No justification request is waiting for your decision.</Text>
        )}
        {queue?.map((item) => (
          <QueueItemCard key={item.id} item={item} />
        ))}

        <Text style={styles.sectionTitle}>Revocable approvals</Text>
        <Text style={styles.hint}>
          Every approval you have ever granted, from any device or session — revoking requires a written note and
          only works while the class's assessment period is still the current one (RULE-JUST-17).
        </Text>
        {decidedError && <ErrorBanner message={errorMessage(decidedError)} />}
        {isDecidedLoading && <Loading />}
        {decided && decided.length === 0 && (
          <Text style={styles.empty}>No approval of yours is available for revocation.</Text>
        )}
        {decided?.map((item) => (
          <RevokeItemRow key={item.id} item={item} />
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

function QueueItemCard({ item }: { item: AbsenceJustificationQueueItem }) {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [note, setNote] = useState('');
  // No onAccessGranted here — unlike the student's own detail screen, this screen has no
  // attachment access log view to invalidate (RULE-JUST-11.4's log is a titular-only feature).
  const { isViewing, viewError, viewAttachment } = useAttachmentViewer(item.submissionId);

  const decideMutation = useMutation({
    mutationFn: (input: DecideAbsenceJustificationItemInput) => decideAbsenceJustificationItem(item.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: DECIDED_QUERY_KEY });
    },
  });

  const noteIsRequired = decision === 'rejected';
  const canSubmit = !decideMutation.isPending && (!noteIsRequired || note.trim().length > 0);

  function handleDecide(): void {
    if (noteIsRequired && !note.trim()) {
      return;
    }
    decideMutation.mutate({ decision, note: note.trim() || undefined });
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardDetail}>Class group: {item.classGroupId}</Text>
      <Text style={styles.cardDetail}>Subject: {item.subjectId}</Text>
      <Text style={styles.cardDetail}>Class: {item.classSessionId}</Text>
      <Text style={styles.cardDetail}>Student: {item.personId}</Text>
      <Text style={styles.cardDetail}>Alleged reason: {LEGAL_CATEGORY_LABELS[item.legalCategory]}</Text>
      <Text style={styles.cardDescription}>{item.description}</Text>

      {viewError && <ErrorBanner message={viewError} />}
      <Pressable style={styles.viewButton} onPress={viewAttachment} disabled={isViewing}>
        {isViewing ? <ActivityIndicator /> : <Text style={styles.viewButtonText}>View attachment</Text>}
      </Pressable>
      <Text style={styles.hint}>
        Document submitted by the student — the system does not verify its authenticity. Deciding below is the
        verification.
      </Text>

      {decideMutation.isError && <ErrorBanner message={errorMessage(decideMutation.error)} />}

      <Text style={styles.label}>Decision</Text>
      <View style={styles.decisionRow}>
        <Pressable
          style={[styles.decisionButton, decision === 'approved' && styles.decisionButtonApproveSelected]}
          onPress={() => setDecision('approved')}
        >
          <Text style={[styles.decisionButtonText, decision === 'approved' && styles.decisionButtonTextSelected]}>
            Approve
          </Text>
        </Pressable>
        <Pressable
          style={[styles.decisionButton, decision === 'rejected' && styles.decisionButtonRejectSelected]}
          onPress={() => setDecision('rejected')}
        >
          <Text style={[styles.decisionButtonText, decision === 'rejected' && styles.decisionButtonTextSelected]}>
            Reject
          </Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Note {noteIsRequired ? '(required to reject)' : '(optional)'}</Text>
      <TextInput
        style={styles.textArea}
        value={note}
        onChangeText={(text) => setNote(text.slice(0, 4000))}
        multiline
        numberOfLines={3}
        editable={!decideMutation.isPending}
      />

      <Pressable
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={handleDecide}
        disabled={!canSubmit}
      >
        {decideMutation.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Register decision</Text>}
      </Pressable>
    </View>
  );
}

function RevokeItemRow({ item }: { item: AbsenceJustificationQueueItem }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const revokeMutation = useMutation({
    mutationFn: () => revokeAbsenceJustificationApproval(item.id, note.trim()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DECIDED_QUERY_KEY }),
  });

  return (
    <View style={styles.card}>
      <Text style={styles.cardDetail}>Class: {item.classSessionId}</Text>
      <Text style={styles.cardDetail}>Student: {item.personId}</Text>
      <StatusBadge label={ITEM_STATUS_BADGE[item.status].label} tone={ITEM_STATUS_BADGE[item.status].tone} />

      {item.status === 'approved' && !isExpanded && (
        <Pressable style={styles.revokeToggleButton} onPress={() => setIsExpanded(true)}>
          <Text style={styles.revokeToggleButtonText}>Revoke approval</Text>
        </Pressable>
      )}

      {item.status === 'approved' && isExpanded && (
        <View>
          {revokeMutation.isError && <ErrorBanner message={errorMessage(revokeMutation.error)} />}
          <Text style={styles.label}>Revocation note (required)</Text>
          <TextInput
            style={styles.textArea}
            value={note}
            onChangeText={(text) => setNote(text.slice(0, 4000))}
            multiline
            numberOfLines={3}
            editable={!revokeMutation.isPending}
          />
          <Pressable
            style={[styles.revokeConfirmButton, (!note.trim() || revokeMutation.isPending) && styles.submitButtonDisabled]}
            disabled={!note.trim() || revokeMutation.isPending}
            onPress={() => revokeMutation.mutate()}
          >
            {revokeMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.revokeConfirmButtonText}>Confirm revocation</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  hint: {
    color: '#777',
    fontSize: 12,
    marginBottom: 12,
  },
  empty: {
    textAlign: 'center',
    color: '#777',
    marginTop: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 4,
  },
  card: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 4,
  },
  cardDetail: {
    color: '#555',
    fontSize: 13,
  },
  cardDescription: {
    color: '#333',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
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
  decisionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  decisionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  decisionButtonApproveSelected: {
    backgroundColor: '#1e7e34',
    borderColor: '#1e7e34',
  },
  decisionButtonRejectSelected: {
    backgroundColor: '#b02a37',
    borderColor: '#b02a37',
  },
  decisionButtonText: {
    fontWeight: '600',
    color: '#333',
  },
  decisionButtonTextSelected: {
    color: '#fff',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#208aef',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  revokeToggleButton: {
    borderWidth: 1,
    borderColor: '#b02a37',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    marginTop: 4,
  },
  revokeToggleButtonText: {
    color: '#b02a37',
    fontWeight: '600',
    fontSize: 13,
  },
  revokeConfirmButton: {
    backgroundColor: '#b02a37',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  revokeConfirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
