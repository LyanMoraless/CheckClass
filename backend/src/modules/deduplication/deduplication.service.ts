import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AttendanceFactorTypeEntity, IdentificationCheckinEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

// RULE-RET-03: state-transition factors (room entry/exit) only collapse a
// double-trigger of the same physical sensor within a short window — never a
// genuine exit-then-return, which RULE-ATT-08 requires summed as distinct
// intervals. Point-in-time identification factors (tag/facial/custom) get a
// longer window since they're single taps, not a sensor pair.
const STATE_TRANSITION_FACTOR_CODES = ['ROOM_ENTRY', 'ROOM_EXIT'];
const STATE_TRANSITION_WINDOW_SECONDS = 2;
const POINT_IN_TIME_WINDOW_SECONDS = 10;

interface CandidateRow {
  id: string;
}

// "Serviço de Deduplicação de Eventos" (architecture-overview.md): sits
// between Identification and the (future) Motor de Regras. Never touches raw
// events, never runs after consolidation — only decides, among
// identification_checkin rows sharing a correlation key, which one is
// canonical (RULE-ATT-10: first received wins).
@Injectable()
export class DeduplicationService {
  private readonly logger = new Logger(DeduplicationService.name);

  constructor(private readonly tenantContext: TenantContextService) {}

  async deduplicate(checkinId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const checkin = await manager.getRepository(IdentificationCheckinEntity).findOneBy({ id: checkinId });
    if (!checkin) {
      this.logger.warn(`Checkin ${checkinId} not found for tenant ${tenantId} — nothing to deduplicate`);
      return;
    }
    if (checkin.isDuplicate) {
      return; // already resolved (e.g. redelivered job)
    }

    const factor = await manager.getRepository(AttendanceFactorTypeEntity).findOneBy({ id: checkin.attendanceFactorTypeId });
    const windowSeconds = STATE_TRANSITION_FACTOR_CODES.includes(factor?.code ?? '')
      ? STATE_TRANSITION_WINDOW_SECONDS
      : POINT_IN_TIME_WINDOW_SECONDS;

    // Code review finding: taking FOR UPDATE on the CANDIDATE row while this
    // transaction goes on to UPDATE the CURRENT (different) row is a
    // lock-order inversion — two checkins that fall within each other's
    // window, processed concurrently by two workers, can each lock the
    // other's row and deadlock. A transaction-scoped advisory lock keyed on
    // the correlation key serializes the whole critical section up front
    // instead, for any number of concurrent workers, and releases
    // automatically on commit/rollback.
    const correlationKey = `${checkin.tenantId}:${checkin.personId}:${checkin.attendanceFactorTypeId}:${checkin.classSessionId ?? 'null'}`;
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [correlationKey]);

    // Correlation key per RULE-RET-03: tenant + person + session + factor type
    // (direction is implicit — ROOM_ENTRY/ROOM_EXIT are different factor
    // type ids). class_session_id can be NULL (event outside any session);
    // IS NOT DISTINCT FROM groups those together instead of losing them to
    // SQL's NULL <> NULL semantics.
    const canonical = await this.findCanonicalWithinWindow(manager, checkin, windowSeconds);

    if (canonical) {
      await manager
        .getRepository(IdentificationCheckinEntity)
        .update({ id: checkinId }, { isDuplicate: true, duplicateOfCheckinId: canonical.id });
    }
    // No canonical found within the window: this checkin stays canonical
    // (is_duplicate already defaults to false) — nothing to write.
  }

  private async findCanonicalWithinWindow(
    manager: EntityManager,
    checkin: IdentificationCheckinEntity,
    windowSeconds: number,
  ): Promise<CandidateRow | undefined> {
    const rows: CandidateRow[] = await manager.query(
      `
      SELECT id FROM identification_checkin
      WHERE tenant_id = $1
        AND person_id = $2
        AND attendance_factor_type_id = $3
        AND class_session_id IS NOT DISTINCT FROM $4
        AND is_duplicate = false
        AND id != $5
        AND checkin_at BETWEEN $6::timestamptz - ($7 * interval '1 second')
                            AND $6::timestamptz + ($7 * interval '1 second')
      ORDER BY created_at ASC
      LIMIT 1
      `,
      [
        checkin.tenantId,
        checkin.personId,
        checkin.attendanceFactorTypeId,
        checkin.classSessionId,
        checkin.id,
        checkin.checkinAt,
        windowSeconds,
      ],
    );
    return rows[0];
  }
}
