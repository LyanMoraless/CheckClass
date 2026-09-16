import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GuardianLinkFollowupEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

// Closed vocabulary for guardian_link_followup.reason (DB CHECK,
// AddGuardianLinkFollowup migration, widened by
// WidenGuardianLinkFollowupReasonVocabulary for the 2 values below).
// Deliberately kept as its own enum (same spirit as auth/permission.enum.ts)
// so a value can be added later and reuse this same table, instead of a
// table per consent type (Solution Architect, architecture-overview.md's
// "Proposta... para o gatilho real do fluxo de responsável legal").
export enum GuardianLinkFollowupReason {
  RETROACTIVE_MINORITY_LOCATION_CONSENT_SUSPENDED = 'retroactive_minority_location_consent_suspended',
  // legal_guardian CRUD's revoke() (architecture-overview.md's "Decisão de
  // arquitetura — CRUD de legal_guardian"): the revoked guardian was the
  // author of the student's most recent GRANTED location consent decision —
  // that consent is retroactively invalidated (LocationConsentSuspensionService).
  LEGAL_GUARDIAN_REVOKED_LOCATION_CONSENT_INVALIDATED = 'legal_guardian_revoked_location_consent_invalidated',
  // Same revoke() flow: the revoked guardian was the student's last
  // remaining ACTIVE legal_guardian AND the student is currently a confirmed
  // minor (isMinor === true, strictly) — no location_consent_decision
  // necessarily involved, relatedLocationConsentDecisionId is null here.
  NO_ACTIVE_LEGAL_GUARDIAN_REMAINING = 'no_active_legal_guardian_remaining',
}

export interface OpenGuardianLinkFollowupInput {
  subjectPersonId: string;
  reason: GuardianLinkFollowupReason;
  relatedLocationConsentDecisionId: string | null;
  triggeredByPersonId: string;
}

// RULE-GRD-07 pendência 1 production-readiness gap (Security, 2026-09-15):
// a real, traceable trigger of the legal-guardian vínculo flow, replacing the
// previous logger.warn-only signal in RetroactiveMinorConsentGuardService.
// Every read/write here goes through TenantContextService.getManager()/
// getTenantId() — same tenant-scoping requirement the Security Agent called
// out explicitly for listAllOpen(), not left implicit (architecture-overview
// .md).
@Injectable()
export class GuardianLinkFollowupService {
  constructor(private readonly tenantContext: TenantContextService) {}

  // Idempotency is a hard requirement, enforced by the DB's partial unique
  // index (tenant_id, subject_person_id, reason) WHERE status = 'open' —
  // at most one open item per subject+reason at a time. Same insert-or-ignore
  // + re-select pattern as PersonManagementService.findOrCreateActorType: a
  // collision here means "already open", not an error to surface to the
  // caller (RetroactiveMinorConsentGuardService just needs SOME open item to
  // exist, not necessarily one it just created).
  async open(input: OpenGuardianLinkFollowupInput): Promise<GuardianLinkFollowupEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(GuardianLinkFollowupEntity);

    const insertResult = await manager
      .createQueryBuilder()
      .insert()
      .into(GuardianLinkFollowupEntity)
      .values({
        tenantId,
        subjectPersonId: input.subjectPersonId,
        reason: input.reason,
        relatedLocationConsentDecisionId: input.relatedLocationConsentDecisionId,
        triggeredByPersonId: input.triggeredByPersonId,
      })
      .orIgnore()
      .returning(['id'])
      .execute();

    const insertedId = insertResult.identifiers[0]?.id as string | undefined;
    if (insertedId) {
      return repository.findOneByOrFail({ id: insertedId });
    }
    // Lost the idempotency race (or a prior call already opened one): the
    // still-open row for this exact subject+reason is the one that matters.
    return repository.findOneByOrFail({ tenantId, subjectPersonId: input.subjectPersonId, reason: input.reason, status: 'open' });
  }

  // Read used by PersonManagementController.resolveGuardianLinkFollowup to
  // verify the followup actually belongs to the :personId in the route,
  // before delegating to resolve() below — kept as a plain nullable lookup
  // (not NotFoundException-throwing) so the controller can fold "does not
  // exist" and "exists but for a different person" into the same 404,
  // without leaking which case it was.
  async findById(followupId: string): Promise<GuardianLinkFollowupEntity | null> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(GuardianLinkFollowupEntity).findOneBy({ id: followupId });
  }

  // Contextual discovery path (architecture-overview.md's "Visibilidade"
  // section, second bullet): GET /v1/users/:personId/date-of-birth composes
  // this to surface a specific person's open items while the Secretaria is
  // already attending them. Filters on (subject_person_id, status = 'open'),
  // which the DB's partial unique index
  // (guardian_link_followup_open_idempotency_idx on
  // tenant_id, subject_person_id, reason WHERE status = 'open') already
  // covers efficiently for this tenant/subject.
  async listOpenBySubject(subjectPersonId: string): Promise<GuardianLinkFollowupEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(GuardianLinkFollowupEntity).find({
      where: { subjectPersonId, status: 'open' },
      order: { openedAt: 'ASC' },
    });
  }

  // All tenant's OPEN items, oldest first — the "varredura periódica como
  // rede de segurança" the user decided on (architecture-overview.md):
  // no cron/notification infrastructure exists to push this, so this report
  // is the whole safety net. No pagination (volume already established as
  // low).
  async listAllOpen(): Promise<GuardianLinkFollowupEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(GuardianLinkFollowupEntity).find({
      where: { status: 'open' },
      order: { openedAt: 'ASC' },
    });
  }

  // Only write path for status = 'resolved' (Solution Architect,
  // architecture-overview.md's "Fechamento" section). resolvedByPersonId is
  // always an explicit parameter here — the controller is the one that reads
  // it from the JWT, this service never trusts a body-supplied value.
  //
  // Conditional UPDATE (WHERE id = :id AND status = 'open') instead of a
  // plain findOne-then-save: this table's column-level GRANT only allows
  // UPDATE on the 4 resolution columns anyway, and the WHERE status = 'open'
  // clause is what actually rejects resolving an already-resolved item at
  // the DB level, not just in application code.
  async resolve(followupId: string, resolvedByPersonId: string, resolutionNote: string): Promise<GuardianLinkFollowupEntity> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(GuardianLinkFollowupEntity);

    const updateResult = await repository.update(
      { id: followupId, status: 'open' },
      { status: 'resolved', resolvedAt: new Date(), resolvedByPersonId, resolutionNote },
    );

    if (updateResult.affected === 0) {
      // The conditional UPDATE above matched nothing — distinguish "does not
      // exist at all" (404) from "exists, but already resolved" (409) with a
      // follow-up read, so the caller knows exactly which case occurred.
      const existing = await repository.findOneBy({ id: followupId });
      if (!existing) {
        throw new NotFoundException(`guardian link followup ${followupId} not found`);
      }
      throw new ConflictException(`guardian link followup ${followupId} is already resolved`);
    }

    return repository.findOneByOrFail({ id: followupId });
  }
}
