import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { isDeviceIntegrityCompromised, isLocationSpoofingDetected } from '../../lib/mobile-security-signals';
import { useLocationConsent } from '../location-consent/use-location-consent';
import { listMySchedule } from '../schedule/schedule-api';
import { reportClassMonitoringReading } from './class-monitoring-api';

// Sparse on purpose — RULE-PRES-09's monitor must emit "discrete transitions", never a
// high-frequency stream (architecture-overview.md's "Escalabilidade" section is explicit
// about this: a continuous GPS stream from every student in every class would dwarf every
// other write path in the project). distanceInterval is set to roughly half the
// institution's reference radius (~50m, RULE-PRES-01/09) so a reading is only even
// considered around the point a student could plausibly be crossing it, and timeInterval
// is a backstop for a device that isn't moving at all. Both are this agent's own
// engineering choice within the architecture's "discrete, not continuous" constraint, not
// a value fixed by any business rule.
const CLASS_MONITORING_DISTANCE_INTERVAL_METERS = 25;
const CLASS_MONITORING_TIME_INTERVAL_MS = 60_000;

interface InProgressSession {
  classSessionId: string;
  scheduledEnd: string;
}

async function findInProgressSession(): Promise<InProgressSession | null> {
  const schedule = await listMySchedule().catch(() => []);
  const now = Date.now();
  const current = schedule.find(
    (entry) => entry.status !== 'cancelled' && new Date(entry.scheduledStart).getTime() <= now && now < new Date(entry.scheduledEnd).getTime(),
  );
  return current ? { classSessionId: current.classSessionId, scheduledEnd: current.scheduledEnd } : null;
}

// RULE-PRES-09's life-short monitor. `active` must be true ONLY while the caller knows the
// person is "presente por login" for a session currently in progress (checkin-screen.tsx
// passes `uiState.phase === 'success' && uiState.result.created` — the exact moment
// RULE-PRES-14's "sessão em que o(a) aluno(a) está registrado(a) como presente por
// check-in estiver em curso" starts being true). Known limitation, flagged rather than
// silently pretended away: if the app is killed/relaunched mid-class, this hook has no
// self-service signal to detect "I already checked into the session currently in
// progress" and won't automatically resume monitoring — see the Mobile Implementation
// Summary's "Flagged issues". Moot for this round regardless, since there is no backend
// endpoint yet to send a reading to (class-monitoring-api.ts).
//
// Gate order mirrors AppCheckinService's own (RULE-PRES-14 checked before anything else
// location-related is even attempted): consent is read first; the OS is never asked to
// watch position at all when consent isn't active, and watching stops immediately if
// consent is revoked mid-class (useLocationConsent's query is the same shared cache
// location-consent-screen.tsx/the offer banner use, so a revoke from either surface is
// picked up here without a dedicated poll).
export function useClassMonitoringSession(active: boolean): void {
  const { hasActiveConsent } = useLocationConsent();
  const [session, setSession] = useState<InProgressSession | null>(null);

  useEffect(() => {
    if (!active || !hasActiveConsent) {
      return undefined;
    }

    let cancelled = false;
    void findInProgressSession().then((found) => {
      if (!cancelled) {
        setSession(found);
      }
    });
    // Clearing `session` on deactivation happens here, in cleanup — never as a synchronous
    // setState call in the effect body itself (react-hooks/set-state-in-effect). Cleanup runs
    // both when `active`/`hasActiveConsent` flips false (the deps change, React tears this run
    // down before the next) and on unmount, which is exactly when "no longer eligible" should
    // clear any session this run found.
    return () => {
      cancelled = true;
      setSession(null);
    };
  }, [active, hasActiveConsent]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    const endMs = new Date(session.scheduledEnd).getTime();
    if (Date.now() >= endMs) {
      // The class this check-in belongs to has already ended by the time the schedule
      // lookup above resolved — nothing left to monitor.
      return undefined;
    }

    let stopped = false;
    let subscription: Location.LocationSubscription | null = null;

    async function startWatching(): Promise<void> {
      // Never requests permission here — location-capture.ts already did, at check-in
      // time, as a prerequisite for consent-gated coordinates to exist at all. If
      // permission was since revoked at the OS level, this simply fails silently
      // (caught below), same fail-open-for-the-student posture as the rest of this flow.
      const permission = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!permission?.granted || stopped || !session) {
        return;
      }
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: CLASS_MONITORING_TIME_INTERVAL_MS,
          distanceInterval: CLASS_MONITORING_DISTANCE_INTERVAL_METERS,
        },
        (location) => {
          if (stopped || !session || Date.now() >= endMs) {
            return;
          }
          reportClassMonitoringReading({
            classSessionId: session.classSessionId,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracyMeters: location.coords.accuracy ?? null,
            isMocked: Boolean(location.mocked) || isDeviceIntegrityCompromised() || isLocationSpoofingDetected(),
          });
        },
      ).catch(() => null);
    }

    void startWatching();

    // Foreground-only — never registers a background task (Location.startLocationUpdatesAsync/
    // startGeofencingAsync), matching the architecture's explicit "nunca contínuo em segundo
    // plano" limit. Leaving the foreground tears the watcher down entirely rather than
    // pausing it; returning resumes it, same as a fresh mount.
    const appStateSubscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') {
        subscription?.remove();
        subscription = null;
      } else if (!subscription && !stopped) {
        void startWatching();
      }
    });

    const endTimer = setTimeout(
      () => {
        stopped = true;
        subscription?.remove();
        subscription = null;
      },
      Math.max(0, endMs - Date.now()),
    );

    return () => {
      stopped = true;
      subscription?.remove();
      appStateSubscription.remove();
      clearTimeout(endTimer);
    };
  }, [session]);
}
