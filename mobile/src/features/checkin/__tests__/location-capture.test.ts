import * as Location from 'expo-location';
import { isDeviceIntegrityCompromised, isLocationSpoofingDetected } from '../../../lib/mobile-security-signals';
import { getMyLocationConsent } from '../../location-consent/location-consent-api';
import { captureCheckInCoordinates } from '../location-capture';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('../../location-consent/location-consent-api', () => ({
  getMyLocationConsent: jest.fn(),
}));

jest.mock('../../../lib/mobile-security-signals', () => ({
  isDeviceIntegrityCompromised: jest.fn().mockReturnValue(false),
  isLocationSpoofingDetected: jest.fn().mockReturnValue(false),
}));

const grantedConsent = { decision: 'granted' } as Awaited<ReturnType<typeof getMyLocationConsent>>;

function mockPosition(overrides: Partial<{ latitude: number; longitude: number; mocked: boolean }> = {}) {
  return {
    coords: { latitude: overrides.latitude ?? -23.561, longitude: overrides.longitude ?? -46.655 },
    timestamp: Date.now(),
    mocked: overrides.mocked ?? false,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (isDeviceIntegrityCompromised as jest.Mock).mockReturnValue(false);
  (isLocationSpoofingDetected as jest.Mock).mockReturnValue(false);
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(mockPosition());
});

test('capture_withoutActiveConsent_neverAsksTheOsForLocationAndReturnsUndefined', async () => {
  (getMyLocationConsent as jest.Mock).mockResolvedValue(null);

  const result = await captureCheckInCoordinates();

  expect(result).toBeUndefined();
  expect(Location.getForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});

test('capture_withRefusedConsent_neverAsksTheOsForLocation', async () => {
  (getMyLocationConsent as jest.Mock).mockResolvedValue({ decision: 'refused' });

  const result = await captureCheckInCoordinates();

  expect(result).toBeUndefined();
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});

test('capture_withActiveConsentAndPermissionAlreadyGranted_returnsCoordinates', async () => {
  (getMyLocationConsent as jest.Mock).mockResolvedValue(grantedConsent);

  const result = await captureCheckInCoordinates();

  expect(result).toEqual({ latitude: -23.561, longitude: -46.655 });
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
});

test('capture_withActiveConsentAndPermissionNotYetGranted_requestsItThenReturnsCoordinates', async () => {
  (getMyLocationConsent as jest.Mock).mockResolvedValue(grantedConsent);
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });

  const result = await captureCheckInCoordinates();

  expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
  expect(result).toEqual({ latitude: -23.561, longitude: -46.655 });
});

test('capture_withPermissionDenied_returnsUndefinedWithoutCallingGetCurrentPosition', async () => {
  (getMyLocationConsent as jest.Mock).mockResolvedValue(grantedConsent);
  (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

  const result = await captureCheckInCoordinates();

  expect(result).toBeUndefined();
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
});

test('capture_withExpoLocationMockedFieldTrue_treatsReadingAsUntrustworthyAndReturnsUndefined', async () => {
  (getMyLocationConsent as jest.Mock).mockResolvedValue(grantedConsent);
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(mockPosition({ mocked: true }));

  const result = await captureCheckInCoordinates();

  expect(result).toBeUndefined();
});

test('capture_whenOsLocationFixFails_returnsUndefinedInsteadOfThrowing', async () => {
  (getMyLocationConsent as jest.Mock).mockResolvedValue(grantedConsent);
  (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(new Error('timeout'));

  await expect(captureCheckInCoordinates()).resolves.toBeUndefined();
});

test('capture_withFreeRaspDeviceIntegrityFlagged_treatsReadingAsUntrustworthyAndReturnsUndefined', async () => {
  (getMyLocationConsent as jest.Mock).mockResolvedValue(grantedConsent);
  (isDeviceIntegrityCompromised as jest.Mock).mockReturnValue(true);

  const result = await captureCheckInCoordinates();

  expect(result).toBeUndefined();
});

test('capture_withFreeRaspLocationSpoofingFlagged_treatsReadingAsUntrustworthyAndReturnsUndefined', async () => {
  (getMyLocationConsent as jest.Mock).mockResolvedValue(grantedConsent);
  (isLocationSpoofingDetected as jest.Mock).mockReturnValue(true);

  const result = await captureCheckInCoordinates();

  expect(result).toBeUndefined();
});
