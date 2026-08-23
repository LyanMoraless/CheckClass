import { useQuery } from '@tanstack/react-query';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { ScreenContainer } from '../../components/screen-container';
import { errorMessage } from '../../lib/api-client';
import { formatDateTime } from '../../lib/format-date';
import { listMyAttendance, summarizeAttendance, type AttendanceEntry, type AttendanceStatus } from './attendance-api';

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  pending: 'Pending review',
};

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  present: '#1e7e34',
  absent: '#b02a37',
  // RULE-ATT-11/RULE-ATT-07/09: pending must never read as a resolved state — a distinct
  // (neither green nor red) color plus its own label and the reason are all deliberate.
  pending: '#a67c00',
};

export function AttendanceScreen() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['my-attendance'],
    queryFn: () => listMyAttendance(),
  });

  const summary = data ? summarizeAttendance(data) : null;

  return (
    <ScreenContainer>
      <Text style={styles.title}>My attendance</Text>
      {error && <ErrorBanner message={errorMessage(error)} />}
      {isLoading && <Loading />}
      {summary && (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {summary.attendanceRate === null ? 'No decided sessions yet' : `${summary.attendanceRate.toFixed(1)}% attendance`}
          </Text>
          <Text style={styles.summarySubtext}>
            {summary.presentCount} present · {summary.absentCount} absent · {summary.pendingCount} pending review
          </Text>
        </View>
      )}
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.classSessionId}
        renderItem={({ item }) => <AttendanceRow entry={item} />}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={!isLoading ? <Text style={styles.empty}>No attendance records yet.</Text> : null}
      />
    </ScreenContainer>
  );
}

function AttendanceRow({ entry }: { entry: AttendanceEntry }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowDate}>
          {formatDateTime(entry.scheduledStart)} – {formatDateTime(entry.scheduledEnd)}
        </Text>
        <Text style={[styles.statusBadge, { color: STATUS_COLOR[entry.status] }]}>{STATUS_LABEL[entry.status]}</Text>
      </View>
      {entry.attendancePercentage !== null && <Text style={styles.rowDetail}>Presence: {entry.attendancePercentage.toFixed(0)}%</Text>}
      {entry.status === 'pending' && entry.pendingReason && <Text style={styles.pendingReason}>Reason: {entry.pendingReason}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  summary: {
    backgroundColor: '#f4f6f8',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 18,
    fontWeight: '600',
  },
  summarySubtext: {
    color: '#555',
    marginTop: 4,
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    paddingVertical: 12,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowDate: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    fontSize: 13,
    fontWeight: '700',
  },
  rowDetail: {
    color: '#555',
    marginTop: 4,
  },
  pendingReason: {
    color: '#a67c00',
    marginTop: 2,
    fontStyle: 'italic',
  },
  empty: {
    textAlign: 'center',
    color: '#777',
    marginTop: 24,
  },
});
