import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { ScreenContainer } from '../../components/screen-container';
import { errorMessage } from '../../lib/api-client';
import { formatDateTime } from '../../lib/format-date';
import { listMyPendingReviews, resolvePendingReview, type PendingReview, type PendingReviewDecision } from './pending-reviews-api';

export function PendingReviewsScreen() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['pending-reviews-mine'],
    queryFn: listMyPendingReviews,
  });

  return (
    <ScreenContainer>
      <Text style={styles.title}>Pending reviews</Text>
      <Text style={styles.hint}>
        Resolving a review is authorized by the leadership chain above that class session (professor, course
        coordinator, or institution head) — not a general permission. An empty list here is expected if you don't
        hold that kind of role.
      </Text>
      {error && <ErrorBanner message={errorMessage(error)} />}
      {isLoading && <Loading />}
      {!isLoading && (data ?? []).length === 0 && <Text style={styles.empty}>No unresolved reviews assigned to you.</Text>}
      {(data ?? []).map((review) => (
        <PendingReviewCard key={review.id} review={review} onRefetch={refetch} />
      ))}
      {isRefetching && <Loading />}
    </ScreenContainer>
  );
}

function PendingReviewCard({ review, onRefetch }: { review: PendingReview; onRefetch: () => void }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: (decision: PendingReviewDecision) => resolvePendingReview(review.id, decision, note),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pending-reviews-mine'] });
      onRefetch();
    },
  });

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Session {review.classSessionId}</Text>
      <Text style={styles.cardDetail}>Person: {review.personId}</Text>
      <Text style={styles.cardDetail}>Reason: {review.reason}</Text>
      <Text style={styles.cardDetail}>Opened: {formatDateTime(review.createdAt)}</Text>
      {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
      <TextInput
        style={styles.noteInput}
        value={note}
        onChangeText={setNote}
        placeholder="Note (optional)"
        editable={!mutation.isPending}
      />
      <View style={styles.actions}>
        <Pressable
          style={[styles.actionButton, styles.presentButton]}
          onPress={() => mutation.mutate('present')}
          disabled={mutation.isPending}
        >
          <Text style={styles.actionButtonText}>Mark present</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.absentButton]}
          onPress={() => mutation.mutate('absent')}
          disabled={mutation.isPending}
        >
          <Text style={styles.actionButtonText}>Mark absent</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
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
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 4,
  },
  cardTitle: {
    fontWeight: '700',
  },
  cardDetail: {
    color: '#555',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  presentButton: {
    backgroundColor: '#1e7e34',
  },
  absentButton: {
    backgroundColor: '#b02a37',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
