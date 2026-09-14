import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { ScreenContainer } from '../../components/screen-container';
import { errorMessage } from '../../lib/api-client';
import { formatSubjectNames } from './leadership-class-groups-format';
import { listMyCoordinatedClassGroups, type CoordinatedClassGroupEntry } from './leadership-class-groups-api';

// Native port of the web dashboard's portal-leadership/leadership-class-groups-page.tsx —
// there, Coordenador de Curso and Direção/Reitoria share the exact same component,
// parametrized only by copy, since GET /v1/me/coordinated-class-groups already resolves the
// right scope (one course's turmas vs. every course's turmas) from the caller's identity
// server-side. This screen goes one step further and drops even that copy parametrization:
// the mobile JWT carries no role/actorType (see (app)/_layout.tsx's comment), so there is no
// client-side signal to key a "Coordenador" vs "Direção" label on. A person with neither role
// simply sees an empty list, same idiom as pending-reviews-screen.tsx.
export function LeadershipClassGroupsScreen() {
  const router = useRouter();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['coordinated-class-groups'],
    queryFn: listMyCoordinatedClassGroups,
  });

  return (
    <ScreenContainer>
      <Text style={styles.title}>Class groups</Text>
      <Text style={styles.hint}>
        Turmas under your leadership — course coordination or institution-wide direction. Open one to see
        student-by-student attendance.
      </Text>
      {error && <ErrorBanner message={errorMessage(error)} />}
      {isLoading && <Loading />}
      <FlatList
        data={data ?? []}
        keyExtractor={(entry) => entry.classGroupId}
        renderItem={({ item }) => (
          <ClassGroupCard entry={item} onPress={() => router.push(`/leadership-class-groups/${item.classGroupId}`)} />
        )}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          !isLoading ? <Text style={styles.empty}>No class group under your leadership at the moment.</Text> : null
        }
      />
    </ScreenContainer>
  );
}

function ClassGroupCard({ entry, onPress }: { entry: CoordinatedClassGroupEntry; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.cardTitle}>{entry.classGroupName}</Text>
      <Text style={styles.cardDetail}>{formatSubjectNames(entry.subjectNames)}</Text>
      <Text style={styles.cardCourse}>{entry.courseName}</Text>
    </Pressable>
  );
}

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
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 4,
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  cardDetail: {
    color: '#555',
    fontSize: 13,
  },
  cardCourse: {
    color: '#888',
    fontSize: 12,
  },
});
