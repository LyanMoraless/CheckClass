import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { removeThreatListener, setThreatListeners, talsecStart, type TalsecConfig } from 'freerasp-react-native';

// Tech Decision — "Detecção de localização simulada e dispositivo comprometido, App
// Mobile" (architecture-overview.md, APROVADA 2026-09-15): Talsec freeRASP is
// camada 2 of the two-layer anti-spoofing signal RULE-PRES-01/09 rely on. Camada 1
// (expo-location's own `LocationObject.mocked` field) lives where the location
// reading itself is taken — checkin/location-capture.ts and
// class-monitoring/use-class-monitoring.ts — not here.
//
// Scope kept deliberately narrow, per the task handoff ("não precisa cobrir cada
// capacidade do freeRASP, só o que RULE-PRES-01/09 exige"): only two threats are
// wired. (1) device-compromise class signals (`privilegedAccess` — root/jailbreak,
// plus `hooks`/`bootloader`/`simulator`, all folded into ONE
// isDeviceIntegrityCompromised() flag — RULE-PRES-01/09 don't distinguish between
// these, they only need "is this device suspicious enough that its location signal
// shouldn't be trusted"), and (2) explicit GPS spoofing (`locationSpoofing`, kept
// as its own isLocationSpoofingDetected() flag). freeRASP's other capabilities
// (screenshot/screen-recording detection, malware scanning, ADB, VPN,
// multi-instance, app integrity, ...) are deliberately NOT wired here — nothing in
// RULE-PRES-01/09 needs them, and wiring them would be scope creep into a decision
// this agent doesn't own.
let deviceIntegrityCompromised = false;
let locationSpoofingDetected = false;
let isRaspStarted = false;

export function isDeviceIntegrityCompromised(): boolean {
  return deviceIntegrityCompromised;
}

export function isLocationSpoofingDetected(): boolean {
  return locationSpoofingDetected;
}

// Test-only reset — this module's flags are process-lifetime state (freeRASP has
// no "undo a detected threat" concept), so a unit test that simulates a threat
// firing needs an explicit way back to a clean slate between cases.
export function __resetMobileSecuritySignalsForTests(): void {
  deviceIntegrityCompromised = false;
  locationSpoofingDetected = false;
  isRaspStarted = false;
}

// Talsec account credentials (watcher email, Android signing certificate SHA-256
// hashes, iOS Team ID) are per-organization secrets nobody has provisioned in this
// environment yet — see the Mobile Implementation Summary's "Flagged issues".
// Starting freeRASP with empty/placeholder values would either reject at the
// native layer or silently misconfigure which app it's protecting, so this
// deliberately skips starting it at all (never crashes, never lies about
// coverage) until real values are supplied via EXPO_PUBLIC_FREERASP_* env vars —
// same "read from EXPO_PUBLIC_* with a safe fallback" idiom as lib/env.ts.
function buildTalsecConfig(): TalsecConfig | null {
  const watcherMail = process.env.EXPO_PUBLIC_FREERASP_WATCHER_MAIL ?? '';
  const androidCertificateHashes = (process.env.EXPO_PUBLIC_FREERASP_ANDROID_CERT_HASHES ?? '')
    .split(',')
    .map((hash) => hash.trim())
    .filter(Boolean);
  const iosAppTeamId = process.env.EXPO_PUBLIC_FREERASP_IOS_TEAM_ID ?? '';
  const packageName = Constants.expoConfig?.android?.package ?? '';
  const bundleIdentifier = Constants.expoConfig?.ios?.bundleIdentifier ?? '';

  if (!watcherMail) {
    return null;
  }
  if (Platform.OS === 'android' && (androidCertificateHashes.length === 0 || !packageName)) {
    return null;
  }
  if (Platform.OS === 'ios' && (!iosAppTeamId || !bundleIdentifier)) {
    return null;
  }

  return {
    watcherMail,
    isProd: !__DEV__,
    // RULE-PRES-01's non-punitive posture ("login é permitido normalmente" even
    // when a signal fails) extended to this layer, deliberately: freeRASP must
    // never itself kill/block the app on a detected threat — it only ever feeds
    // the read-only flags above, which location-capture.ts/
    // use-class-monitoring.ts use to withhold the location reading, exactly like
    // an already-failing rede/geo gate. Never true.
    killOnBypass: false,
    androidConfig: { packageName, certificateHashes: androidCertificateHashes },
    iosConfig: { appBundleId: bundleIdentifier, appTeamId: iosAppTeamId },
  };
}

// Mounted once, for the whole app lifetime (app/_layout.tsx) — matches the Tech
// Decision's "checagem 100% local no aparelho" running continuously, not scoped to
// check-in/class-monitoring specifically: a compromised device is compromised
// before the person ever taps check-in. Mirrors freerasp-react-native's own
// useFreeRasp hook internals (module-level isRaspStarted guard against
// React StrictMode's dev-only double-invoke of effects) rather than calling that
// hook directly, because useFreeRasp always calls talsecStart unconditionally —
// this needs to skip starting entirely when buildTalsecConfig() has no real
// credentials to start with (see that function's own comment).
export function useMobileSecuritySignals(): void {
  useEffect(() => {
    const config = buildTalsecConfig();
    if (!config) {
      return undefined;
    }

    void (async () => {
      await setThreatListeners({
        privilegedAccess: () => {
          deviceIntegrityCompromised = true;
        },
        hooks: () => {
          deviceIntegrityCompromised = true;
        },
        bootloader: () => {
          deviceIntegrityCompromised = true;
        },
        simulator: () => {
          deviceIntegrityCompromised = true;
        },
        locationSpoofing: () => {
          locationSpoofingDetected = true;
        },
      });

      if (isRaspStarted) {
        return;
      }
      try {
        await talsecStart(config);
        isRaspStarted = true;
      } catch {
        // Best-effort — same posture as auth-context.tsx's secure-store
        // try/catch: a failure to start RASP must not crash the app or block
        // check-in, it just means this device's anti-spoofing signal degrades
        // to camada 1 only (expo-location's own `mocked` field).
      }
    })();

    return () => {
      void removeThreatListener();
    };
  }, []);
}
