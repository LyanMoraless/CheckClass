import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { ScreenContainer } from '../../components/screen-container';
import { errorMessage } from '../../lib/api-client';
import { formatDateTime } from '../../lib/format-date';
import { LEGAL_CATEGORY_LABELS, listMyAbsenceJustifications, type AbsenceJustificationSubmission } from './absence-justification-api';

// "YYYY-MM-DD" -> "DD/MM/YYYY" read as plain numbers, never through `new Date(...)` — same
// reasoning/precedent as warnings-screen.tsx's own formatDateOnly (startDate/endDate are
// DATE-only fields, no time component, so parsing them back into a JS Date would reintroduce a
// local-midnight/UTC shift bug).
function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

// Aluno-only screen — RULE-JUST-06: a submission has NO aggregate status on purpose
// ("aprovado"/"rejeitado" são estados do ITEM, não do envio), so this list only shows
// submission-level facts (period, category, description, when it was sent). Per-item status
// only appears once the student opens a specific request's detail — native port of the web
// dashboard's my-justifications-page.tsx.
export function MyJustificationsScreen() {
  const router = useRouter();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['my-justifications'],
    queryFn: listMyAbsenceJustifications,
  });

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>My justification requests</Text>
        <Pressable style={styles.newButton} onPress={() => router.push('/justifications/new')}>
          <Text style={styles.newButtonText}>New request</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        You don't pick a subject: every class you missed within the informed period, in any subject, enters the
        request automatically. Each class is decided individually by the corresponding teacher.
      </Text>
      {error && <ErrorBanner message={errorMessage(error)} />}
      {isLoading && <Loading />}
      <FlatList
        data={data ?? []}
        keyExtractor={(submission) => submission.id}
        renderItem={({ item }) => (
          <SubmissionCard submission={item} onPress={() => router.push(`/justifications/${item.id}`)} />
        )}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={!isLoading ? <Text style={styles.empty}>You haven't submitted any justification request yet.</Text> : null}
      />
    </ScreenContainer>
  );
}

function SubmissionCard({ submission, onPress }: { submission: AbsenceJustificationSubmission; onPress: () => void }) {
  const rangeLabel =
    submission.startDate === submission.endDate
      ? formatDateOnly(submission.startDate)
      : `${formatDateOnly(submission.startDate)} to ${formatDateOnly(submission.endDate)}`;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.cardDates}>{rangeLabel}</Text>
      <Text style={styles.cardCategory}>{LEGAL_CATEGORY_LABELS[submission.legalCategory]}</Text>
      <Text style={styles.cardDescription} numberOfLines={2}>
        {submission.description}
      </Text>
      <Text style={styles.cardMeta}>Submitted {formatDateTime(submission.createdAt)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    flexShrink: 1,
  },
  newButton: {
    backgroundColor: '#208aef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
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
  cardMeta: {
    color: '#888',
    fontSize: 11,
    marginTop: 4,
  },
});
