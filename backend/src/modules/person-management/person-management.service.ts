import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'bcrypt';
import { QueryFailedError } from 'typeorm';
import { ActorTypeEntity, GuardianLinkFollowupEntity, PersonCredentialEntity, PersonEntity } from '../../database/entities';
import { BirthDateConfirmationState, deriveMinorityStatus } from '../../common/minority-status.util';
import { dateKeyOfUtc } from '../../common/utc-date.util';
import { TenantContextService } from '../../database/tenant-context.service';
import { GuardianLinkFollowupService } from '../guardian-link-followup/guardian-link-followup.service';
import { RetroactiveMinorConsentGuardService } from './retroactive-minor-consent-guard.service';

const BCRYPT_SALT_ROUNDS = 10;
const UNIQUE_VIOLATION = '23505';

export interface CreatePersonInput {
  fullName: string;
  actorTypeCode: string;
  cpf?: string;
  password?: string;
}

export interface CreatedPerson {
  personId: string;
  actorTypeId: string;
}

export interface ListedPerson {
  personId: string;
  fullName: string;
  actorTypeCode: string;
  hasLoginCredential: boolean;
}

// RULE-GRD-05 read-control allowlist: this is the raw, Secretaria-only shape
// — never returned by any other endpoint/consumer in this codebase. Anyone
// else must receive the PersonMinorityStatusService-derived boolean instead.
export interface PersonDateOfBirthDetail {
  personId: string;
  dateOfBirth: string | null;
  confirmedAt: Date | null;
  confirmedByPersonId: string | null;
  confirmationState: BirthDateConfirmationState;
  // Contextual discovery path for guardian_link_followup (architecture
  // -overview.md's "Visibilidade" section, second bullet): this person's
  // OPEN items, surfaced while the Secretaria is already attending them.
  // Returned as the raw entity (not a narrower shape like the other fields
  // above) — same Secretaria-only allowlist as the rest of this interface,
  // and GET /v1/guardian-link-followups already returns the same shape
  // tenant-wide, so there is no narrower "public" version to protect here.
  openGuardianLinkFollowups: GuardianLinkFollowupEntity[];
}

export interface ConfirmedDateOfBirth {
  personId: string;
  dateOfBirth: string;
  confirmedAt: Date;
  confirmedByPersonId: string;
}

// Minimal "manage users" capability behind the MANAGE_USERS permission
// (confirmed 2026-08-22) — create a person, optionally with login
// credentials. Group assignment is a separate call
// (PermissionGroupService.assignPersonToGroup), already built in the auth
// module.
@Injectable()
export class PersonManagementService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly retroactiveMinorConsentGuard: RetroactiveMinorConsentGuardService,
    private readonly guardianLinkFollowup: GuardianLinkFollowupService,
  ) {}

  async createPerson(input: CreatePersonInput): Promise<CreatedPerson> {
    if (Boolean(input.cpf) !== Boolean(input.password)) {
      // Code review finding: previously silently skipped credential
      // creation when only one of the two was set, with no signal to the
      // caller that a login was NOT created.
      throw new BadRequestException('cpf and password must both be provided, or neither');
    }

    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const actorType = await this.findOrCreateActorType(input.actorTypeCode);

    const personRepository = manager.getRepository(PersonEntity);
    const person = await personRepository.save(
      personRepository.create({ tenantId, actorTypeId: actorType.id, fullName: input.fullName }),
    );

    if (input.cpf && input.password) {
      await this.createCredential(tenantId, person.id, input.cpf, input.password);
    }

    return { personId: person.id, actorTypeId: actorType.id };
  }

  // Added for the admin frontend: every screen that needs to pick a person
  // (enrollment, wristband issue, permission-group membership) needs a way
  // to look one up — there was no read path for this at all previously.
  //
  // RULE-GRD-05 read-control allowlist (Security Agent, architecture-overview
  // .md, "Controle de leitura de person.date_of_birth"): this endpoint is
  // reachable by MANAGE_INSTITUTION_STRUCTURE too (see controller), a wider
  // audience than the Secretaria alone — date_of_birth (raw or derived) MUST
  // NOT be added to this SELECT. Anyone who genuinely needs the derived "é
  // menor" boolean for one of these people should call
  // PersonMinorityStatusService.getStatus(personId) instead of widening this
  // query.
  async list(): Promise<ListedPerson[]> {
    const manager = this.tenantContext.getManager();
    return manager.query(`
      SELECT
        p.id AS "personId",
        p.full_name AS "fullName",
        at.code AS "actorTypeCode",
        (pc.id IS NOT NULL) AS "hasLoginCredential"
      FROM person p
      JOIN actor_type at ON at.id = p.actor_type_id
      LEFT JOIN person_credential pc ON pc.person_id = p.id
      ORDER BY p.full_name ASC
    `);
  }

  // RULE-GRD-05: raw date_of_birth read, restricted to the Secretaria-only
  // surface of this controller (class-level MANAGE_USERS, no method-level
  // widening — unlike list() above). Used by the Secretaria's own UI to
  // pre-fill the confirmation form with whatever value (if any) is already
  // on file.
  async getDateOfBirthDetail(personId: string): Promise<PersonDateOfBirthDetail> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(PersonEntity);
    const person = await repository.findOneBy({ id: personId });
    if (!person) {
      throw new NotFoundException(`person ${personId} not found`);
    }

    const { confirmationState } = deriveMinorityStatus(person);
    const openGuardianLinkFollowups = await this.guardianLinkFollowup.listOpenBySubject(personId);
    return {
      personId: person.id,
      dateOfBirth: toDateOnlyString(person.dateOfBirth),
      confirmedAt: person.dateOfBirthConfirmedAt,
      confirmedByPersonId: person.dateOfBirthConfirmedByPersonId,
      confirmationState,
      openGuardianLinkFollowups,
    };
  }

  // RULE-GRD-07: the Secretaria's presencial confirmation — fills/corrects
  // date_of_birth AND stamps confirmed_at/confirmed_by in the same call,
  // always resulting in the "confirmado presencialmente" state (never
  // "provisório" — this backend has no self-declaration endpoint today, see
  // ConfirmDateOfBirthDto's header). Reuses this same Secretaria-restricted
  // controller/service rather than a parallel endpoint, per RULE-GRD-05's
  // "conferência presencial" pattern.
  async confirmDateOfBirth(personId: string, dateOfBirth: string, confirmedByPersonId: string): Promise<ConfirmedDateOfBirth> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(PersonEntity);
    const person = await repository.findOneBy({ id: personId });
    if (!person) {
      throw new NotFoundException(`person ${personId} not found`);
    }

    const confirmedAt = new Date();
    await repository.update(
      { id: personId },
      {
        dateOfBirth: new Date(dateOfBirth),
        dateOfBirthConfirmedAt: confirmedAt,
        dateOfBirthConfirmedByPersonId: confirmedByPersonId,
      },
    );

    // RULE-GRD-07 pendência 1 (retroactive risk): only relevant once the
    // CONFIRMED result reveals minority — a provisional value never reaches
    // this branch anyway (this method always confirms).
    const { isMinor } = deriveMinorityStatus({ dateOfBirth, dateOfBirthConfirmedAt: confirmedAt });
    if (isMinor) {
      await this.retroactiveMinorConsentGuard.suspendSensitiveConsentsIfGranted(personId, confirmedByPersonId);
    }

    return { personId, dateOfBirth, confirmedAt, confirmedByPersonId };
  }

  private async findOrCreateActorType(code: string): Promise<ActorTypeEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const actorTypeRepository = manager.getRepository(ActorTypeEntity);

    const existing = await actorTypeRepository.findOneBy({ code });
    if (existing) {
      return existing;
    }

    // Code review finding: plain find-then-create raced under concurrent
    // calls for the same not-yet-existing code (no DB constraint backed the
    // "one row per tenant+code" assumption). Insert-or-ignore against the
    // new UNIQUE(tenant_id, code) constraint (AddActorTypeCodeUnique
    // migration), then re-select on the losing side of the race instead of
    // ending up with two rows for the same logical actor type.
    const insertResult = await manager
      .createQueryBuilder()
      .insert()
      .into(ActorTypeEntity)
      .values({ tenantId, code, name: code })
      .orIgnore()
      .returning(['id'])
      .execute();

    const insertedId = insertResult.identifiers[0]?.id as string | undefined;
    if (insertedId) {
      return actorTypeRepository.findOneByOrFail({ id: insertedId });
    }
    return actorTypeRepository.findOneByOrFail({ code });
  }

  private async createCredential(tenantId: string, personId: string, cpf: string, password: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const passwordHash = await hash(password, BCRYPT_SALT_ROUNDS);
    const credentialRepository = manager.getRepository(PersonCredentialEntity);
    try {
      await credentialRepository.save(credentialRepository.create({ tenantId, personId, cpf, passwordHash }));
    } catch (error) {
      // Security review finding: this previously fell through to an
      // unhandled 500, which also acted as a cross-tenant enumeration
      // side-channel (500 vs 201 disclosed whether a CPF had an account
      // ANYWHERE in the system, not just this tenant).
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION) {
        throw new ConflictException('CPF already has an account (CPF must be unique across the whole platform)');
      }
      throw error;
    }
  }
}

// person.date_of_birth comes back as a plain "YYYY-MM-DD" string from
// repository.findOneBy (the same driver inconsistency documented in
// common/utc-date.util.ts) — normalized here defensively in case a future
// caller ever reads it through a path that returns a real Date instead.
function toDateOnlyString(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }
  return typeof value === 'string' ? value : dateKeyOfUtc(value);
}
