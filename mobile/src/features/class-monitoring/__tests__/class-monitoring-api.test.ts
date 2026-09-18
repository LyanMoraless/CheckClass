import { apiClient } from '../../../lib/api-client';
import { generateIdempotencyKey } from '../../../lib/idempotency-key';
import { reportClassMonitoringReading } from '../class-monitoring-api';

jest.mock('../../../lib/api-client', () => ({
  apiClient: { post: jest.fn() },
}));

jest.mock('../../../lib/idempotency-key', () => ({
  generateIdempotencyKey: jest.fn(),
}));

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

const reading = {
  classSessionId: 'session-1',
  latitude: -23.561,
  longitude: -46.655,
  accuracyMeters: 12,
  isMocked: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  (generateIdempotencyKey as jest.Mock).mockReturnValue('idem-key-1');
});

// POST /v1/class-monitoring-signals (backend's ReportClassMonitoringSignalDto): same field
// names/shapes as ClassMonitoringReading, plus a client-generated idempotencyKey — mirrors
// AppCheckinDto's own resend-tolerance contract.
test('reportClassMonitoringReading_readingWithAccuracy_postsSignalWithGeneratedIdempotencyKey', async () => {
  (apiClient.post as jest.Mock).mockResolvedValue({ signalId: 'signal-1', created: true });

  reportClassMonitoringReading(reading);
  await flushPromises();

  expect(apiClient.post).toHaveBeenCalledWith('/v1/class-monitoring-signals', {
    idempotencyKey: 'idem-key-1',
    classSessionId: 'session-1',
    latitude: -23.561,
    longitude: -46.655,
    accuracyMeters: 12,
    isMocked: false,
  });
});

// ReportClassMonitoringSignalDto.accuracyMeters is required (NOT NULL in the DB) — see that
// DTO's own comment for why a null reading (only reachable on Expo web in practice) is
// dropped client-side rather than coerced to an invented sentinel value.
test('reportClassMonitoringReading_nullAccuracy_dropsReadingWithoutCallingApi', async () => {
  reportClassMonitoringReading({ ...reading, accuracyMeters: null });
  await flushPromises();

  expect(apiClient.post).not.toHaveBeenCalled();
});

// Fire-and-forget, same posture as the rest of this monitor: a failed send is simply lost,
// never surfaced to the caller (use-class-monitoring.ts never awaits this call).
test('reportClassMonitoringReading_apiCallRejects_doesNotThrowOrLeaveUnhandledRejection', async () => {
  (apiClient.post as jest.Mock).mockRejectedValue(new Error('network down'));

  expect(() => reportClassMonitoringReading(reading)).not.toThrow();
  await flushPromises();
});
