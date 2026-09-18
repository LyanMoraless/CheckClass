import * as Location from 'expo-location';
import { isDeviceIntegrityCompromised, isLocationSpoofingDetected } from '../../lib/mobile-security-signals';
import { getMyLocationConsent } from '../location-consent/location-consent-api';
import type { CheckInCoordinates } from './checkin-api';

// RULE-PRES-01(b)/RULE-PRES-14/15 gate, run client-side before use-checkin.ts ever
// submits a check-in. "Antes de sequer tentar capturar, consultar
// GET /v1/me/location-consent — se não houver consentimento ativo, o check-in é
// enviado sem coordenadas e a localização nunca é sequer solicitada ao SO"
// (task handoff, architecture-overview.md's App Mobile component card).
//
// Every early return here (no consent, permission denied, OS location failure,
// untrustworthy reading) resolves to `undefined` rather than throwing — the check-in
// itself must always still be attempted (AppCheckinDto.latitude/longitude are
// optional exactly for this: a present-but-untrustworthy reading is server-side
// fail-closed inside AppCheckinService, same as an absent one; see that DTO's own
// comment). This function's only job is deciding whether a reading is even worth
// sending, never whether check-in succeeds.
export async function captureCheckInCoordinates(): Promise<CheckInCoordinates | undefined> {
  const consent = await getMyLocationConsent().catch(() => null);
  if (consent?.decision !== 'granted') {
    // RULE-PRES-15's caminho alternativo — the OS is never even asked for
    // permission/location for a titular without active consent.
    return undefined;
  }

  const existingPermission = await Location.getForegroundPermissionsAsync().catch(() => null);
  const granted = existingPermission?.granted || (await Location.requestForegroundPermissionsAsync().catch(() => null))?.granted;
  if (!granted) {
    return undefined;
  }

  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null);
  if (!position) {
    return undefined;
  }

  // Two anti-spoofing layers approved in "Decisão de tecnologia — Detecção de
  // localização simulada e dispositivo comprometido" (architecture-overview.md):
  // camada 1 (expo-location's own `mocked` field, Android-only) and camada 2
  // (Talsec freeRASP, mobile-security-signals.ts). Either signal is enough to
  // withhold the reading — same non-punitive, no-audit-trail posture RULE-PRES-01
  // already fixes for a failed rede/geo gate: check-in still proceeds normally,
  // just without a location factor, and nothing about the failed signal is
  // reported anywhere (there is no backend field for it to go to).
  const untrustworthy = Boolean(position.mocked) || isDeviceIntegrityCompromised() || isLocationSpoofingDetected();
  if (untrustworthy) {
    return undefined;
  }

  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}
