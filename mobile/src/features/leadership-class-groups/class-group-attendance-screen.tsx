import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { ScreenContainer } from '../../components/screen-container';
import { errorMessage } from '../../lib/api-client';
import { formatAttendanceRate } from './leadership-class-groups-format';
import { getClassGroupAttendance, type ClassGroupAttendanceEntry } from './leadership-class-groups-api';

// Reached from LeadershipClassGroupsScreen — native port of the web dashboard's
// portal-class-group-attendance/class-group-attendance-page.tsx. A 403 here (caller no longer
// has authority over this specific turma, per LeadershipScopeService) is not handled
// specially — it surfaces through the normal ErrorBanner path, same as every other screen.
export function ClassGroupAttendanceScreen({ classGroupId }: { classGroupId: string }) {
  const router = useRouter();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['class-group-attendance', classGroupId],
    queryFn: () => getClassGroupAttendance(classGroupId),
  });

  return (
    <ScreenContainer>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.backLink}>← Back to class groups</Text>
      </Pressable>

      <Text style={styles.title}>Class group attendance</Text>
      <Text style={styles.hint}>Attendance summary for every student enrolled in this class group.</Text>

      {error && <ErrorBanner message={errorMessage(error)} />}
      {isLoading && <Loading />}
      <FlatList
        data={data ?? []}
        keyExtractor={(entry) => entry.personId}
        renderItem={({ item }) => <StudentAttendanceRow entry={item} />}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={!isLoading ? <Text style={styles.empty}>No student enrolled in this class group yet.</Text> : null}
      />
    </ScreenContainer>
  );
}

function StudentAttendanceRow({ entry }: { entry: ClassGroupAttendanceEntry }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{entry.fullName}</Text>
      <View style={styles.cardGrid}>
        <DetailCell label="Evaluated" value={String(entry.sessionsEvaluated)} />
        <DetailCell label="Present" value={String(entry.presentCount)} />
        <DetailCell label="Absent" value={String(entry.absentCount)} />
        <DetailCell label="Pending" value={String(entry.pendingCount)} />
        <DetailCell label="Rate" value={formatAttendanceRate(entry.attendanceRate)} />
      </View>
    </View>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailCell}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backLink: {
    color: '#208aef',
    fontWeight: '600',
    marginBottom: 12,
  },
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
    gap: 8,
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 15,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailCell: {
    minWidth: 70,
  },
  detailLabel: {
    color: '#666',
    fontSize: 11,
  },
  detailValue: {
    fontWeight: '600',
    fontSize: 13,
  },
});
