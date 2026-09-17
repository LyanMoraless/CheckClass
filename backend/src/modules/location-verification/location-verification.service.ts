import { Injectable, NotFoundException } from '@nestjs/common';
import { ClassSessionEntity, InstitutionalLocationConfigEntity, RawLocationSignalEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

const EARTH_RADIUS_METERS = 6371000;

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface DepartureEvaluation {
  isWithinRadius: boolean;
  // null only when isWithinRadius is true (nothing currently "departing").
  departureStartedAt: Date | null;
  departureMinutesElapsed: number;
  // class_session.departureTimeoutMinutesSnapshot (RULE-PRES-09) — surfaced
  // so the caller never has to re-fetch class_session just to explain the
  // verdict below.
  departureTimeoutMinutes: number;
  prolongedDepartureDetected: boolean;
}

// RULE-PRES-01(b) (login gate) and RULE-PRES-09 (afastamento prolongado) —
// "Decisão de arquitetura — Fluxo de Chamada Redesenhado" (architecture-
// overview.md). Shared, stateless-per-call decision primitive, same idiom as
// InstitutionalNetworkService.isWithinInstitutionalNetwork: called explicitly
// by whichever caller needs it (AppCheckinService for RULE-PRES-01(b),
// room-presence's afastamento monitor for RULE-PRES-09 — neither wired yet,
// both left for the next implementation round per this round's task scope),
// never a guard/middleware global.
//
// Both rules reuse the SAME raio configurável da instituição
// (institutional_location_config, one row per tenant) — RULE-PRES-09's own
// text confirms this is the same parameter used for two different questions,
// not a second one. isCoordinateWithinRadius below is the single geometric
// check both public methods delegate to, so the radius comparison is never
// implemented twice.
@Injectable()
export class LocationVerificationService {
  constructor(private readonly tenantContext: TenantContextService) {}

  // RULE-PRES-01(b): is `coordinates` within the institution's configured
  // radius of its reference point? Fail-closed on missing config (no row
  // configured for the tenant yet) — same posture as
  // InstitutionalNetworkService's "no ranges configured => outside" default;
  // what "outside" means to the caller (block the login factor, keep
  // monitoring an afastamento already in progress, ...) is entirely up to
  // that caller, this primitive only ever answers the yes/no geometry
  // question.
  async isWithinInstitutionalRadius(tenantId: string, coordinates: GeoCoordinates): Promise<boolean> {
    const config = await this.getConfig(tenantId);
    if (!config) {
      return false;
    }
    return this.isCoordinateWithinRadius(config, coordinates);
  }

  // RULE-PRES-09: does the current reading, combined with this person's
  // already-persisted class_monitoring history for this specific session
  // (raw_location_signal, append-only — this service only ever reads it,
  // never writes to it; persistence is whichever caller ingests the app's
  // discrete afastamento transition events, not built in this round), show a
  // CONTINUOUS departure (outside the institutional radius) that has already
  // lasted at least class_session.departureTimeoutMinutesSnapshot?
  //
  // `coordinates` is evaluated geometrically through the exact same
  // isCoordinateWithinRadius check as isWithinInstitutionalRadius above (one
  // config fetch here, reused for both the current reading and every
  // historical row below — not a second implementation of the radius
  // comparison, just a single extra DB round trip avoided).
  // asOfDate defaults to "now" (the live-caller shape, e.g. the app's own
  // afastamento monitor calling this in real time) — a SECOND caller,
  // room-presence's retroactive getSessionProjectedInterval (RULE-PRES-08),
  // passes the session's own scheduledEnd instead. Without this, a
  // departure that started 5 minutes before class ended but only gets
  // EVALUATED hours later (evaluateSession has no upper bound on when it
  // runs, only a lower one — see its own "has not ended yet" guard) would
  // wrongly read as "prolonged" against wall-clock Date.now(), when it never
  // crossed the threshold during the class itself.
  async evaluateDepartureFromClassLocation(
    tenantId: string,
    personId: string,
    classSessionId: string,
    coordinates: GeoCoordinates,
    asOfDate: Date = new Date(),
  ): Promise<DepartureEvaluation> {
    const manager = this.tenantContext.getManager();
    const classSession = await manager.getRepository(ClassSessionEntity).findOneBy({ id: classSessionId, tenantId });
    if (!classSession) {
      throw new NotFoundException(`class session ${classSessionId} not found`);
    }

    const config = await this.getConfig(tenantId);
    const isWithinRadius = config ? this.isCoordinateWithinRadius(config, coordinates) : false;
    const departureTimeoutMinutes = classSession.departureTimeoutMinutesSnapshot;

    if (isWithinRadius) {
      return { isWithinRadius: true, departureStartedAt: null, departureMinutesElapsed: 0, departureTimeoutMinutes, prolongedDepartureDetected: false };
    }

    const departureStartedAt = await this.resolveDepartureStartedAt(tenantId, personId, classSessionId, config);
    const departureMinutesElapsed = (asOfDate.getTime() - departureStartedAt.getTime()) / 60000;

    return {
      isWithinRadius: false,
      departureStartedAt,
      departureMinutesElapsed,
      departureTimeoutMinutes,
      prolongedDepartureDetected: departureMinutesElapsed >= departureTimeoutMinutes,
    };
  }

  private async getConfig(tenantId: string): Promise<InstitutionalLocationConfigEntity | null> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(InstitutionalLocationConfigEntity).findOneBy({ tenantId });
  }

  // Walks this person's class_monitoring history for this session, most
  // recent first, until it finds the last reading that WAS within the
  // radius (the moment the current, still-ongoing departure began right
  // after) or runs out of rows (the departure has been ongoing since the
  // earliest recorded reading). No history at all => the current reading is
  // the first evidence of departure, so it just started (server clock, per
  // RULE-PRES-02 — never a device-supplied timestamp).
  private async resolveDepartureStartedAt(
    tenantId: string,
    personId: string,
    classSessionId: string,
    config: InstitutionalLocationConfigEntity | null,
  ): Promise<Date> {
    const manager = this.tenantContext.getManager();
    const readings = await manager.getRepository(RawLocationSignalEntity).find({
      where: { tenantId, personId, classSessionId, signalType: 'class_monitoring' },
      order: { capturedAt: 'DESC' },
    });

    let departureStartedAt = new Date();
    for (const reading of readings) {
      const wasWithinRadius = config
        ? this.isCoordinateWithinRadius(config, { latitude: Number(reading.latitude), longitude: Number(reading.longitude) })
        : false;
      if (wasWithinRadius) {
        break;
      }
      departureStartedAt = reading.capturedAt;
    }
    return departureStartedAt;
  }

  private isCoordinateWithinRadius(config: InstitutionalLocationConfigEntity, coordinates: GeoCoordinates): boolean {
    const distanceMeters = this.calculateDistanceMeters({ latitude: Number(config.latitude), longitude: Number(config.longitude) }, coordinates);
    return distanceMeters <= config.radiusMeters;
  }

  // Haversine great-circle distance — precise enough at the scale this
  // decision needs (institutional radius, reference value ~50m per
  // RULE-PRES-01/09) without pulling in PostGIS, consistent with the
  // Database Agent's "why no PostGIS" call already recorded on
  // institutional_location_config.
  private calculateDistanceMeters(a: GeoCoordinates, b: GeoCoordinates): number {
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
    const deltaLatitude = toRadians(b.latitude - a.latitude);
    const deltaLongitude = toRadians(b.longitude - a.longitude);
    const latitudeA = toRadians(a.latitude);
    const latitudeB = toRadians(b.latitude);

    const haversine =
      Math.sin(deltaLatitude / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;
    const angularDistance = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
    return EARTH_RADIUS_METERS * angularDistance;
  }
}
