import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LegalGuardianEntity, PersonEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { GuardianLinkFollowupReason, GuardianLinkFollowupService } from '../guardian-link-followup/guardian-link-followup.service';
import { LocationConsentSuspensionService } from '../location-consent-guard/location-consent-suspension.service';
import { PersonMinorityStatusService } from '../person-management/person-minority-status.service';

export interface CreateLegalGuardianInput {
  studentPersonId: string;
  fullName: string;
  documentNumber: string;
  registeredByPersonId: string;
}

export interface UpdateLegalGuardianInput {
  fullName?: string;
  documentNumber?: string;
}

// "Decisão de arquitetura — CRUD de legal_guardian" (architecture-overview.md,
// approved 2026-09-15). First real CRUD for legal_guardian — previously only
// referenced as a FK by location_consent_decision and
// RetroactiveMinorConsentGuardService.
@Injectable()
export class LegalGuardianService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly locationConsentSuspension: LocationConsentSuspensionService,
    private readonly guardianLinkFollowup: GuardianLinkFollowupService,
    private readonly personMinorityStatus: PersonMinorityStatusService,
  ) {}

  // signature_captured_at is never set here — the DB column default (now())
  // is what actually captures it (AddLegalGuardianAndLocationConsentDecision
  // migration), so a client-supplied timestamp can never retrodate the
  // presencial conferência (RULE-GRD-05).
  async create(input: CreateLegalGuardianInput): Promise<LegalGuardianEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const student = await manager.getRepository(PersonEntity).findOneBy({ id: input.studentPersonId });
    if (!student) {
      throw new NotFoundException(`person ${input.studentPersonId} not found`);
    }

    const repository = manager.getRepository(LegalGuardianEntity);
    return repository.save(
      repository.create({
        tenantId,
        studentPersonId: input.studentPersonId,
        fullName: input.fullName,
        documentNumber: input.documentNumber,
        registeredByPersonId: input.registeredByPersonId,
      }),
    );
  }

  // Only status = 'active' by default — the parcial index
  // (tenant_id, student_person_id) WHERE status='active' already covers this
  // path efficiently. `?status=all` (includeRevoked = true) also returns
  // revoked links, ordered by createdAt ASC either way.
  async listByStudent(studentPersonId: string, includeRevoked = false): Promise<LegalGuardianEntity[]> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(LegalGuardianEntity);
    return repository.find({
      where: includeRevoked ? { studentPersonId } : { studentPersonId, status: 'active' },
      order: { createdAt: 'ASC' },
    });
  }

  // Plain nullable lookup — used by LegalGuardianController to confirm a
  // guardianId actually belongs to the :personId in the route before
  // update()/revoke(), same idiom as
  // GuardianLinkFollowupService.findById/resolveGuardianLinkFollowup (fold
  // "does not exist" and "exists for a different person" into the same 404,
  // without disclosing which case it was).
  async findById(guardianId: string): Promise<LegalGuardianEntity | null> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(LegalGuardianEntity).findOneBy({ id: guardianId });
  }

  // Conditional UPDATE (WHERE id = :id AND status = 'active') instead of a
  // plain findOne-then-save: the column-level GRANT only allows UPDATE on
  // (full_name, document_number, status, updated_at) anyway, and the WHERE
  // status = 'active' clause is what actually rejects editing an
  // already-revoked link at the DB level, not just in application code —
  // same pattern as GuardianLinkFollowupService.resolve.
  async update(guardianId: string, input: UpdateLegalGuardianInput): Promise<LegalGuardianEntity> {
    if (input.fullName === undefined && input.documentNumber === undefined) {
      throw new BadRequestException('at least one of fullName/documentNumber must be provided');
    }

    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(LegalGuardianEntity);

    const updateResult = await repository.update(
      { id: guardianId, status: 'active' },
      {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.documentNumber !== undefined ? { documentNumber: input.documentNumber } : {}),
      },
    );

    if (updateResult.affected === 0) {
      await this.rejectAlreadyRevokedOrMissing(repository, guardianId);
    }

    return repository.findOneByOrFail({ id: guardianId });
  }

  // Conditional UPDATE, same 404/409 pattern as update() above, followed by
  // two independent, non-exclusive checks (both may fire on the same call —
  // they answer different questions, see architecture-overview.md):
  // 1. invalidateConsentIfDecidedByThisGuardian — this guardian authored the
  //    student's most recent GRANTED location consent decision.
  // 2. openFollowupIfNoActiveGuardianRemains — this was the student's last
  //    remaining active guardian AND the student is currently a confirmed
  //    minor (isMinor === true, strictly).
  async revoke(guardianId: string, revokedByPersonId: string): Promise<LegalGuardianEntity> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(LegalGuardianEntity);

    const updateResult = await repository.update({ id: guardianId, status: 'active' }, { status: 'revoked' });

    if (updateResult.affected === 0) {
      await this.rejectAlreadyRevokedOrMissing(repository, guardianId);
    }

    const revoked = await repository.findOneByOrFail({ id: guardianId });

    await this.invalidateConsentIfDecidedByThisGuardian(revoked, revokedByPersonId);
    await this.openFollowupIfNoActiveGuardianRemains(revoked, revokedByPersonId);

    return revoked;
  }

  private async invalidateConsentIfDecidedByThisGuardian(
    guardian: LegalGuardianEntity,
    triggeredByPersonId: string,
  ): Promise<void> {
    const latest = await this.locationConsentSuspension.getLatestDecision(guardian.studentPersonId);
    if (!latest || latest.decision !== 'granted' || latest.decidedByLegalGuardianId !== guardian.id) {
      return;
    }

    await this.locationConsentSuspension.suspendAndOpenFollowup({
      subjectPersonId: guardian.studentPersonId,
      latest,
      reason: GuardianLinkFollowupReason.LEGAL_GUARDIAN_REVOKED_LOCATION_CONSENT_INVALIDATED,
      triggeredByPersonId,
    });
  }

  private async openFollowupIfNoActiveGuardianRemains(guardian: LegalGuardianEntity, triggeredByPersonId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const remainingActiveCount = await manager
      .getRepository(LegalGuardianEntity)
      .count({ where: { studentPersonId: guardian.studentPersonId, status: 'active' } });
    if (remainingActiveCount > 0) {
      return;
    }

    // Strictly isMinor === true — not null (unknown) nor false (adult): a
    // student with no confirmed date_of_birth already gets RULE-GRD-07's
    // soft block on sensitive consent independent of guardians, so this
    // alert would be operational noise without any action required (Solution
    // Architect, architecture-overview.md's "Pendências em aberto" item 5).
    const { isMinor } = await this.personMinorityStatus.getStatus(guardian.studentPersonId);
    if (isMinor !== true) {
      return;
    }

    await this.guardianLinkFollowup.open({
      subjectPersonId: guardian.studentPersonId,
      reason: GuardianLinkFollowupReason.NO_ACTIVE_LEGAL_GUARDIAN_REMAINING,
      relatedLocationConsentDecisionId: null,
      triggeredByPersonId,
    });
  }

  // Shared by update()/revoke(): the conditional UPDATE above matched
  // nothing — distinguish "does not exist at all" (404) from "exists, but
  // already revoked" (409) with a follow-up read, same idiom as
  // GuardianLinkFollowupService.resolve.
  private async rejectAlreadyRevokedOrMissing(repository: Repository<LegalGuardianEntity>, guardianId: string): Promise<never> {
    const existing = await repository.findOneBy({ id: guardianId });
    if (!existing) {
      throw new NotFoundException(`legal guardian ${guardianId} not found`);
    }
    throw new ConflictException(`legal guardian ${guardianId} is already revoked`);
  }
}
