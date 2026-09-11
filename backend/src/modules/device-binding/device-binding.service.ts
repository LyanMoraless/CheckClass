import { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ClassGroupEntity, ClassSessionEntity, DeviceBindingEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { DeviceCredentialService, AuthenticationCeremonyOptions } from '../device-identity/device-credential.service';
import { InstitutionalNetworkService } from '../institutional-network/institutional-network.service';
import { CheckoutReason } from './checkout-reason.enum';
import { DeviceBindingConfigService } from './device-binding-config.service';

const UNIQUE_VIOLATION = '23505';

export type DeviceBindingFactorState = 'present' | 'absent' | 'not_applicable';

interface InProgressSessionAt {
  id: string;
  scheduledEnd: Date;
}

export interface CreatedDeviceBinding {
  binding: DeviceBindingEntity;
  inactivityTimeoutMinutes: number;
}

// Ciclo de vida do vínculo pessoa<->máquina (RULE-DEV-06/07/08). device-binding
// is the only writer of device_binding — the Motor de Regras only ever reads
// through evaluateFactorForClassSession below (mão única, same shape as Motor
// de Regras -> Serviço de Configuração).
@Injectable()
export class DeviceBindingService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly deviceCredentialService: DeviceCredentialService,
    private readonly deviceBindingConfigService: DeviceBindingConfigService,
    private readonly institutionalNetworkService: InstitutionalNetworkService,
  ) {}

  // ---- Login ceremony (wraps device-identity's WebAuthn verification) ----

  generateLoginOptions(): Promise<AuthenticationCeremonyOptions> {
    return this.deviceCredentialService.generateAuthenticationCeremonyOptions();
  }

  async completeLogin(
    personId: string,
    challengeToken: string,
    response: AuthenticationResponseJSON,
    sourceIp: string,
  ): Promise<CreatedDeviceBinding> {
    // deviceIdentityId is NEVER accepted from the request body (RULE-DEV-01
    // nota C4) — it only ever comes out of a successfully verified WebAuthn
    // assertion.
    const { deviceIdentityId } = await this.deviceCredentialService.verifyAuthentication(challengeToken, response);
    return this.createBinding(personId, deviceIdentityId, sourceIp);
  }

  // ---- Binding lifecycle ----

  async createBinding(personId: string, deviceIdentityId: string, sourceIp: string): Promise<CreatedDeviceBinding> {
    // GAP-10 (RULE-DEV-14): the vínculo can only be created from inside the
    // institution's declared network — the rule's own "Applies to" names
    // ONLY the vínculo's creation, never checkout, so this check has no
    // counterpart anywhere else in this file. Checked ahead of the
    // RULE-DEV-07 active-binding check on purpose: someone outside the
    // network should see the real reason for rejection, not "you already
    // have an active binding" as a red herring.
    const tenantId = this.tenantContext.getTenantId();
    const withinNetwork = await this.institutionalNetworkService.isWithinInstitutionalNetwork(tenantId, sourceIp);
    if (!withinNetwork) {
      throw new ForbiddenException(
        `Device binding creation for person ${personId} requires being inside the institutional network (RULE-DEV-14)`,
      );
    }

    // Rede de segurança preguiçosa (Tech Decision B) applied BEFORE the
    // RULE-DEV-07 check — normalizes a stale "active" row whose class
    // session already ended, so a person is never wrongly blocked from a
    // legitimate new login by a binding that should already be checked out.
    await this.sweepActiveBindingForPerson(personId);

    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(DeviceBindingEntity);

    const existingActive = await repository.findOneBy({ personId, status: 'active' });
    if (existingActive) {
      // RULE-DEV-07: one active institutional-device binding per person —
      // checked defensively here; device_binding_one_active_per_person_unique
      // (AddDeviceBinding migration) is the final race-safety net, caught
      // below.
      throw new ConflictException(`Person ${personId} already has an active device binding (RULE-DEV-07) — check out first`);
    }

    let binding: DeviceBindingEntity;
    try {
      binding = await repository.save(
        repository.create({ tenantId, personId, deviceIdentityId, status: 'active', startedAt: new Date() }),
      );
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string } | undefined)?.code === UNIQUE_VIOLATION) {
        throw new ConflictException(`Person ${personId} already has an active device binding (RULE-DEV-07)`);
      }
      throw error;
    }

    const { inactivityTimeoutMinutes } = await this.deviceBindingConfigService.getEffective();
    return { binding, inactivityTimeoutMinutes };
  }

  // Idempotent state transition (Solution Architect's exact desenho): every
  // one of RULE-DEV-06's four triggers converges on this same
  // UPDATE ... WHERE status = 'active' — whichever reaches the database
  // first wins, the rest silently no-op. No lock, no queue.
  async checkout(bindingId: string, reason: CheckoutReason, occurredAt: Date = new Date()): Promise<void> {
    const manager = this.tenantContext.getManager();
    await manager
      .getRepository(DeviceBindingEntity)
      .update({ id: bindingId, status: 'active' }, { status: 'checked_out', checkedOutAt: occurredAt, checkoutReason: reason });
  }

  // Gatilhos 1/3/4 (logout, inactivity, token expiry) all call this — the
  // frontend already knows it is acting on ITS OWN person (RULE-DEV-01 nota
  // C4's anti-spoofing posture: bindingId is never accepted from the client,
  // "my active binding" is always resolved server-side from the JWT).
  async checkoutMine(personId: string, reason: CheckoutReason): Promise<{ checkedOut: boolean }> {
    const manager = this.tenantContext.getManager();
    const active = await manager.getRepository(DeviceBindingEntity).findOneBy({ personId, status: 'active' });
    if (!active) {
      return { checkedOut: false };
    }
    await this.checkout(active.id, reason);
    return { checkedOut: true };
  }

  async getActiveForPerson(personId: string): Promise<DeviceBindingEntity | null> {
    await this.sweepActiveBindingForPerson(personId);
    const manager = this.tenantContext.getManager();
    return manager.getRepository(DeviceBindingEntity).findOneBy({ personId, status: 'active' });
  }

  // RULE-DEV-13/RULE-ACC-08 read — active bindings and history, gated by the
  // VIEW_DEVICE_BINDINGS permission at the controller.
  async listActiveAndHistory(): Promise<DeviceBindingEntity[]> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(DeviceBindingEntity);

    const activeRows = await repository.findBy({ status: 'active' });
    const distinctPersonIds = [...new Set(activeRows.map((row) => row.personId))];
    for (const personId of distinctPersonIds) {
      // eslint-disable-next-line no-await-in-loop -- small, bounded set (one
      // row per currently-active person); sequential is simpler than
      // Promise.all here and this isn't a hot path.
      await this.sweepActiveBindingForPerson(personId);
    }

    return repository.find({ order: { startedAt: 'DESC' } });
  }

  // ---- Motor de Regras read primitive (mão única — device-binding never
  // writes anything on this module's behalf, RULE-DEV-10) ----

  async evaluateFactorForClassSession(personId: string, session: ClassSessionEntity): Promise<DeviceBindingFactorState> {
    // Rede de segurança preguiçosa applied here too, per Tech Decision B —
    // evaluateSession() only ever runs after scheduledEnd has passed
    // (attendance-rules-engine.service.ts's own precondition), so this is
    // exactly the point where a still-"active" binding tied to THIS session
    // would otherwise be stale.
    await this.sweepActiveBindingForPerson(personId);

    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    // device_binding_person_started_at_idx (AddDeviceBinding migration) backs
    // this range scan; checked_out_at compared directly in the query, same
    // approach the migration's own comment anticipates. LEFT JOINs resolve
    // which subtype this binding's device_identity is, in one round trip.
    const rows: Array<{ institutional_room_id: string | null; is_personal_device: boolean }> = await manager.query(
      `
      SELECT im.room_id AS institutional_room_id, (pd.id IS NOT NULL) AS is_personal_device
      FROM device_binding db
      LEFT JOIN institutional_machine im ON im.id = db.device_identity_id
      LEFT JOIN personal_device pd ON pd.id = db.device_identity_id
      WHERE db.tenant_id = $1
        AND db.person_id = $2
        AND db.started_at <= $3::timestamptz
        AND (db.checked_out_at IS NULL OR db.checked_out_at >= $4::timestamptz)
      ORDER BY db.started_at DESC
      LIMIT 1
      `,
      [tenantId, personId, session.scheduledEnd.toISOString(), session.scheduledStart.toISOString()],
    );

    if (rows.length === 0) {
      return 'absent';
    }
    const row = rows[0];

    if (row.is_personal_device) {
      // RULE-DEV-09 emended: BYOD has no room field to diverge — always
      // counts when a binding overlaps the session window.
      return 'present';
    }

    // RULE-INST-07's inheritance: session.roomId ?? class_group.roomId, same
    // COALESCE fallback IdentificationService.resolveClassSession already
    // established for effective room.
    const effectiveRoomId = session.roomId ?? (await this.resolveClassGroupRoomId(session.classGroupId));
    if (!effectiveRoomId || row.institutional_room_id !== effectiveRoomId) {
      // RULE-DEV-09: room mismatch (or no resolvable session room at all) —
      // NOT a missing_factor pending, deliberately a third state.
      return 'not_applicable';
    }
    return 'present';
  }

  // ---- Gatilho 2 (fim de sessão de aula), lazy safety net ----

  // Tech Decision B: gatilho 2 has no push event — evaluated lazily
  // (scheduledEnd < now(), computed on read, never a timer fixed at binding
  // creation, since class_session.scheduledEnd can be edited afterward).
  // Called from every read path that treats a binding as "active"
  // (createBinding's RULE-DEV-07 check, getActiveForPerson,
  // listActiveAndHistory, evaluateFactorForClassSession) per Tech Decision
  // B's "rede de segurança preguiçosa" note.
  private async sweepActiveBindingForPerson(personId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const active = await manager.getRepository(DeviceBindingEntity).findOneBy({ personId, status: 'active' });
    if (!active) {
      return;
    }

    // Interpretation (not spelled out verbatim by RULE-DEV-06/RULE-DEV-09):
    // "the session this binding is tied to" is taken to be whichever class
    // session was in progress, for one of this person's enrolled turmas, AT
    // THE MOMENT the binding started — not "whatever session is in progress
    // right now". A binding started outside any class session (RULE-DEV-08)
    // has no session to tie gatilho 2 to, and correctly never gets swept by
    // this trigger — it still checks out normally via the other three.
    const session = await this.findClassSessionInProgressAt(personId, active.startedAt);
    if (session && new Date() >= session.scheduledEnd) {
      await this.checkout(active.id, CheckoutReason.SESSION_END, session.scheduledEnd);
    }
  }

  private async findClassSessionInProgressAt(personId: string, at: Date): Promise<InProgressSessionAt | null> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    // Same enrolled-turma + scheduled-window resolution strategy
    // AppCheckinService.resolveActiveClassSession already uses (no room
    // signal available here either) — LIMIT 1 rather than disambiguating an
    // overlapping-turmas edge case: this is a best-effort safety net, not a
    // strict business rule, so picking any matching session is an accepted
    // approximation (consistent with Tech Decision B's own "honestidade
    // explícita" about this mechanism never being exact).
    const rows: Array<{ id: string; scheduled_end: string }> = await manager.query(
      `
      SELECT cs.id, cs.scheduled_end
      FROM class_group_enrollment cge
      JOIN class_session cs ON cs.class_group_id = cge.class_group_id
      WHERE cge.tenant_id = $1
        AND cge.person_id = $2
        AND cs.scheduled_start <= $3::timestamptz
        AND cs.scheduled_end >= $3::timestamptz
      LIMIT 1
      `,
      [tenantId, personId, at.toISOString()],
    );
    if (rows.length === 0) {
      return null;
    }
    return { id: rows[0].id, scheduledEnd: new Date(rows[0].scheduled_end) };
  }

  private async resolveClassGroupRoomId(classGroupId: string): Promise<string | null> {
    const manager = this.tenantContext.getManager();
    const classGroup = await manager.getRepository(ClassGroupEntity).findOneBy({ id: classGroupId });
    return classGroup?.roomId ?? null;
  }
}
