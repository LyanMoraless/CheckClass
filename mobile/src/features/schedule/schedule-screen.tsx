import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { ScreenContainer } from '../../components/screen-container';
import { errorMessage } from '../../lib/api-client';
import { formatDateTime } from '../../lib/format-date';
import { listMySchedule, type ScheduleEntry } from './schedule-api';

export function ScheduleScreen() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['my-schedule'],
    queryFn: listMySchedule,
  });

  return (
    <ScreenContainer>
      <Text style={styles.title}>My schedule</Text>
      {error && <ErrorBanner message={errorMessage(error)} />}
      {isLoading && <Loading />}
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.classSessionId}
        renderItem={({ item }) => <ScheduleRow entry={item} />}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={!isLoading ? <Text style={styles.empty}>No scheduled sessions.</Text> : null}
      />
    </ScreenContainer>
  );
}

function ScheduleRow({ entry }: { entry: ScheduleEntry }) {
  const isInProgress = isNowWithin(entry.scheduledStart, entry.scheduledEnd);
  return (
    <View style={[styles.row, isInProgress && styles.rowInProgress]}>
      <Text style={styles.rowDate}>
        {formatDateTime(entry.scheduledStart)} – {formatDateTime(entry.scheduledEnd)}
      </Text>
      <Text style={styles.rowDetail}>Room: {entry.roomId}</Text>
      {isInProgress && <Text style={styles.inProgressBadge}>In progress now</Text>}
    </View>
  );
}

function isNowWithin(start: string, end: string): boolean {
  const now = Date.now();
  return now >= new Date(start).getTime() && now <= new Date(end).getTime();
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    paddingVertical: 12,
  },
  rowInProgress: {
    backgroundColor: '#eaf6ff',
  },
  rowDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowDetail: {
    color: '#555',
    marginTop: 4,
  },
  inProgressBadge: {
    color: '#208aef',
    fontWeight: '700',
    marginTop: 4,
  },
  empty: {
    textAlign: 'center',
    color: '#777',
    marginTop: 24,
  },
});
