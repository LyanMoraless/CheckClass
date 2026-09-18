import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  __resetMobileSecuritySignalsForTests,
  isDeviceIntegrityCompromised,
  isLocationSpoofingDetected,
  useMobileSecuritySignals,
} from '../mobile-security-signals';

// jest.mock's factory may only close over variables prefixed with `mock` (case-insensitive)
// — see jest's own "module factory is not allowed to reference any out-of-scope variables"
// guard — hence the naming here, not this file's usual convention.
const mockSetThreatListeners = jest.fn().mockResolvedValue(undefined);
const mockRemoveThreatListener = jest.fn().mockResolvedValue(undefined);
const mockTalsecStart = jest.fn().mockResolvedValue('freeRASP started');

jest.mock('freerasp-react-native', () => ({
  setThreatListeners: (...args: unknown[]) => mockSetThreatListeners(...args),
  removeThreatListener: (...args: unknown[]) => mockRemoveThreatListener(...args),
  talsecStart: (...args: unknown[]) => mockTalsecStart(...args),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { android: { package: 'com.checkclass.mobile' }, ios: { bundleIdentifier: 'com.checkclass.mobile' } } },
}));

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

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

// Renderers left mounted across tests keep their effect's async chain interleaving with the
// next test's own timing — tracked here and unmounted in afterEach so each test starts clean.
const activeRenderers: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    activeRenderers.forEach((renderer) => renderer.unmount());
  });
  activeRenderers.length = 0;
});

function Harness() {
  useMobileSecuritySignals();
  return null;
}

function renderHarness(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<Harness />);
  });
  activeRenderers.push(renderer);
  return renderer;
}

const ENV_KEYS = ['EXPO_PUBLIC_FREERASP_WATCHER_MAIL', 'EXPO_PUBLIC_FREERASP_ANDROID_CERT_HASHES', 'EXPO_PUBLIC_FREERASP_IOS_TEAM_ID'] as const;

function configureCredentials(): void {
  process.env.EXPO_PUBLIC_FREERASP_WATCHER_MAIL = 'security@checkclass.example';
  process.env.EXPO_PUBLIC_FREERASP_ANDROID_CERT_HASHES = 'abc123';
  process.env.EXPO_PUBLIC_FREERASP_IOS_TEAM_ID = 'TEAM1234';
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetMobileSecuritySignalsForTests();
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

test('mount_withoutTalsecCredentialsConfigured_neverStartsRasp', async () => {
  renderHarness();
  await act(async () => {
    await flushPromises();
  });

  expect(mockTalsecStart).not.toHaveBeenCalled();
  expect(mockSetThreatListeners).not.toHaveBeenCalled();
});

test('mount_withCredentialsConfigured_startsRaspWithNonPunitiveConfig', async () => {
  configureCredentials();
  process.env.EXPO_PUBLIC_FREERASP_ANDROID_CERT_HASHES = 'abc123, def456';

  renderHarness();
  await waitUntil(() => mockTalsecStart.mock.calls.length > 0);

  expect(mockTalsecStart).toHaveBeenCalledWith(
    expect.objectContaining({
      watcherMail: 'security@checkclass.example',
      killOnBypass: false,
      androidConfig: { packageName: 'com.checkclass.mobile', certificateHashes: ['abc123', 'def456'] },
      iosConfig: { appBundleId: 'com.checkclass.mobile', appTeamId: 'TEAM1234' },
    }),
  );
});

test('threatListener_privilegedAccess_flagsDeviceIntegrityCompromised', async () => {
  configureCredentials();

  renderHarness();
  await waitUntil(() => mockSetThreatListeners.mock.calls.length > 0);

  expect(isDeviceIntegrityCompromised()).toBe(false);
  const actions = mockSetThreatListeners.mock.calls[0][0];
  actions.privilegedAccess();
  expect(isDeviceIntegrityCompromised()).toBe(true);
});

test('threatListener_locationSpoofing_flagsLocationSpoofingDetectedSeparatelyFromDeviceIntegrity', async () => {
  configureCredentials();

  renderHarness();
  await waitUntil(() => mockSetThreatListeners.mock.calls.length > 0);

  const actions = mockSetThreatListeners.mock.calls[0][0];
  actions.locationSpoofing();

  expect(isLocationSpoofingDetected()).toBe(true);
  expect(isDeviceIntegrityCompromised()).toBe(false);
});

test('unmount_removesTheThreatListener', async () => {
  configureCredentials();

  renderHarness();
  await waitUntil(() => mockSetThreatListeners.mock.calls.length > 0);

  act(() => {
    activeRenderers.pop()!.unmount();
  });

  expect(mockRemoveThreatListener).toHaveBeenCalled();
});
