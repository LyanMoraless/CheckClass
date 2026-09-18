import * as Location from 'expo-location';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useLocationConsent } from '../../location-consent/use-location-consent';
import { listMySchedule } from '../../schedule/schedule-api';
import { reportClassMonitoringReading } from '../class-monitoring-api';
import { useClassMonitoringSession } from '../use-class-monitoring';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

jest.mock('../../location-consent/use-location-consent', () => ({
  useLocationConsent: jest.fn(),
}));

jest.mock('../../schedule/schedule-api', () => ({
  listMySchedule: jest.fn(),
}));

jest.mock('../class-monitoring-api', () => ({
  reportClassMonitoringReading: jest.fn(),
}));

// Avoids pulling in the real freerasp-react-native package here — its own module-load-time
// `new NativeEventEmitter(...)` call throws outside a real native runtime, and this test only
// cares about use-class-monitoring.ts's own gating/throttling logic, not freeRASP's.
jest.mock('../../../lib/mobile-security-signals', () => ({
  isDeviceIntegrityCompromised: jest.fn().mockReturnValue(false),
  isLocationSpoofingDetected: jest.fn().mockReturnValue(false),
}));

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

// Polls instead of guessing a fixed flush count — this hook chains two effects (schedule
// lookup, then permission check + watchPositionAsync), each an extra micro/macrotask hop.
async function waitUntil(predicate: () => boolean, attempts = 20): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) {
      return;
    }
    await act(async () => {
      await flushPromises();
    });
  }
  if (!predicate()) {
    throw new Error('waitUntil: predicate never became true');
  }
}

// Renderers left mounted across tests keep effects/subscriptions alive and can interleave with
// the next test's own timing — tracked here and unmounted in afterEach so each test starts clean.
const activeRenderers: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    activeRenderers.forEach((renderer) => renderer.unmount());
  });
  activeRenderers.length = 0;
});

function renderHarness(active: boolean): void {
  function Harness({ active: isActive }: { active: boolean }) {
    useClassMonitoringSession(isActive);
    return null;
  }
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<Harness active={active} />);
  });
  activeRenderers.push(renderer);
}

const removeSubscription = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useLocationConsent as jest.Mock).mockReturnValue({ hasActiveConsent: true });
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (Location.watchPositionAsync as jest.Mock).mockResolvedValue({ remove: removeSubscription });
});

function inProgressScheduleEntry(classSessionId: string) {
  const now = Date.now();
  return {
    classSessionId,
    classGroupId: 'group-1',
    classGroupName: 'Turma A',
    subjectName: 'Math',
    roomId: 'room-1',
    roomName: 'Room 1',
    scheduledStart: new Date(now - 5 * 60_000).toISOString(),
    scheduledEnd: new Date(now + 30 * 60_000).toISOString(),
    status: 'scheduled' as const,
  };
}

test('inactive_neverFetchesScheduleOrWatchesPosition', async () => {
  renderHarness(false);
  await act(async () => {
    await flushPromises();
  });

  expect(listMySchedule).not.toHaveBeenCalled();
  expect(Location.watchPositionAsync).not.toHaveBeenCalled();
});

test('active_withoutActiveConsent_neverFetchesScheduleOrWatchesPosition', async () => {
  (useLocationConsent as jest.Mock).mockReturnValue({ hasActiveConsent: false });

  renderHarness(true);
  await act(async () => {
    await flushPromises();
  });

  expect(listMySchedule).not.toHaveBeenCalled();
  expect(Location.watchPositionAsync).not.toHaveBeenCalled();
});

test('active_withConsentAndNoInProgressSession_neverWatchesPosition', async () => {
  (listMySchedule as jest.Mock).mockResolvedValue([]);

  renderHarness(true);
  await waitUntil(() => (listMySchedule as jest.Mock).mock.calls.length > 0);
  await act(async () => {
    await flushPromises();
  });

  expect(Location.watchPositionAsync).not.toHaveBeenCalled();
});

test('active_withConsentAndInProgressSession_startsWatchingAndReportsAReading', async () => {
  (listMySchedule as jest.Mock).mockResolvedValue([inProgressScheduleEntry('session-1')]);

  renderHarness(true);
  await waitUntil(() => (Location.watchPositionAsync as jest.Mock).mock.calls.length > 0);

  expect(Location.watchPositionAsync).toHaveBeenCalledWith(
    expect.objectContaining({ distanceInterval: 25 }),
    expect.any(Function),
  );

  const callback = (Location.watchPositionAsync as jest.Mock).mock.calls[0][1];
  act(() => {
    callback({ coords: { latitude: -23.561, longitude: -46.655, accuracy: 12 }, timestamp: Date.now(), mocked: false });
  });

  expect(reportClassMonitoringReading).toHaveBeenCalledWith({
    classSessionId: 'session-1',
    latitude: -23.561,
    longitude: -46.655,
    accuracyMeters: 12,
    isMocked: false,
  });
});

test('active_withSessionAlreadyEnded_neverWatchesPosition', async () => {
  const now = Date.now();
  (listMySchedule as jest.Mock).mockResolvedValue([
    { ...inProgressScheduleEntry('session-2'), scheduledStart: new Date(now - 60 * 60_000).toISOString(), scheduledEnd: new Date(now - 5_000).toISOString() },
  ]);

  renderHarness(true);
  await waitUntil(() => (listMySchedule as jest.Mock).mock.calls.length > 0);
  await act(async () => {
    await flushPromises();
  });

  // The schedule lookup itself only returns sessions where now < scheduledEnd, so an
  // already-ended session never even resolves as "in progress" — nothing to watch.
  expect(Location.watchPositionAsync).not.toHaveBeenCalled();
});

test('unmount_removesTheWatchSubscription', async () => {
  (listMySchedule as jest.Mock).mockResolvedValue([inProgressScheduleEntry('session-3')]);

  renderHarness(true);
  await waitUntil(() => (Location.watchPositionAsync as jest.Mock).mock.calls.length > 0);
  // watchPositionAsync having been CALLED doesn't mean its promise has resolved and been
  // assigned to the hook's local `subscription` variable yet — one more flush lets that
  // `await` complete before unmounting, otherwise cleanup finds a still-null subscription.
  await act(async () => {
    await flushPromises();
  });

  act(() => {
    activeRenderers.pop()!.unmount();
  });

  expect(removeSubscription).toHaveBeenCalled();
});
