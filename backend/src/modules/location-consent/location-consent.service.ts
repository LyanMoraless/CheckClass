import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { LocationConsentDecisionEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { LocationConsentSuspensionService } from '../location-consent-guard/location-consent-suspension.service';
import { PersonMinorityStatusService } from '../person-management/person-minority-status.service';

type LocationConsentDecisionValue = 'granted' | 'refused' | 'revoked';

interface RecordDecisionInput {
  subjectPersonId: string;
  decision: LocationConsentDecisionValue;
  decidedByType: 'person' | 'legal_guardian';
  decidedByPersonId: string | null;
  decidedByLegalGuardianId: string | null;
  consentVersion: string;
}

// RULE-PRES-14/15 — "location-consent", irmão do já existente
// location-consent-guard (architecture-overview.md, addendum 2026-09-16 e
// "Implementação — location-verification e location-consent"). Sobre a
// MESMA tabela location_consent_decision (append-only, sem migration nova) —
// location-consent-guard só grava decided_by_type='system'/decision='revoked'
// (suspensão automática, RULE-GRD-07); este serviço é quem de fato implementa
// os verbos de ator de RULE-PRES-14: conceder/recusar/revogar, por titular ou
// por responsável legal.
//
// getActiveConsent/hasActiveConsent NÃO reimplementam a leitura de "qual é a
// decisão vigente" — delegam a LocationConsentSuspensionService.getLatestDecision,
// já existente, a mesma leitura que o próprio location-consent-guard usa
// internamente. Os dois pontos de consumo reais desta leitura (gate no App
// Mobile antes do monitor; terceira checagem no AppCheckinService) ficam para
// a próxima etapa de implementação — este módulo só expõe o serviço pronto.
@Injectable()
export class LocationConsentService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly locationConsentSuspension: LocationConsentSuspensionService,
    private readonly personMinorityStatus: PersonMinorityStatusService,
  ) {}

  async getActiveConsent(subjectPersonId: string): Promise<LocationConsentDecisionEntity | null> {
    return this.locationConsentSuspension.getLatestDecision(subjectPersonId);
  }

  async hasActiveConsent(subjectPersonId: string): Promise<boolean> {
    const latest = await this.getActiveConsent(subjectPersonId);
    return latest?.decision === 'granted';
  }

  // Self-service grant (App Mobile, titular decidindo por si). Gated in two
  // steps, both reusing PersonMinorityStatusService rather than
  // reimplementing any part of the "é menor" check:
  // 1. assertSensitiveConsentGateOpen — this is RULE-PRES-14's own documented
  //    plug-in point (see that method's header) — blocks while
  //    date_of_birth confirmation is "ausente"/"provisório" (RULE-GRD-07
  //    pendência 3): majority is genuinely unknown, so self-consent can't be
  //    accepted either way yet.
  // 2. isMinor === true even after confirmation — self-consent is never
  //    accepted for a CONFIRMED minor (mesmo espírito de RULE-GRD-01/07):
  //    that consent must come from a legal guardian instead
  //    (grantByGuardian below), never from the minor themself.
  async grantForSelf(personId: string, consentVersion: string): Promise<LocationConsentDecisionEntity> {
    await this.personMinorityStatus.assertSensitiveConsentGateOpen(personId);
    const { isMinor } = await this.personMinorityStatus.getStatus(personId);
    if (isMinor) {
      throw new ForbiddenException(
        `Person ${personId} is a confirmed minor — location consent cannot be self-granted (RULE-GRD-01/07); it must be granted by a legal guardian.`,
      );
    }

    return this.recordDecision({
      subjectPersonId: personId,
      decision: 'granted',
      decidedByType: 'person',
      decidedByPersonId: personId,
      decidedByLegalGuardianId: null,
      consentVersion,
    });
  }

  // Refusing/revoking is never gated by minority status — it's a protective
  // act (withdraws/declines data collection), not an exercise of the
  // capacity the grant-side gate above exists to guard. Any titular, minor
  // or not, confirmed or not, can always decline or withdraw their own
  // location consent.
  async refuseForSelf(personId: string, consentVersion: string): Promise<LocationConsentDecisionEntity> {
    return this.recordDecision({
      subjectPersonId: personId,
      decision: 'refused',
      decidedByType: 'person',
      decidedByPersonId: personId,
      decidedByLegalGuardianId: null,
      consentVersion,
    });
  }

  async revokeForSelf(personId: string): Promise<LocationConsentDecisionEntity> {
    const latest = await this.assertRevocableAndGetLatest(personId);
    return this.recordDecision({
      subjectPersonId: personId,
      decision: 'revoked',
      decidedByType: 'person',
      decidedByPersonId: personId,
      decidedByLegalGuardianId: null,
      consentVersion: latest.consentVersion,
    });
  }

  // Legal-guardian-driven decisions (Secretaria, atendimento presencial,
  // RULE-GRD-02/03) — exactly the path assertSensitiveConsentGateOpen's own
  // header says must NEVER go through that gate: a guardian consenting on
  // behalf of a minor is the correct path, not the risk it guards against.
  // Callers (LocationConsentGuardianController) are responsible for
  // confirming guardianId is an ACTIVE legal_guardian link of
  // studentPersonId before calling any of these — this service trusts that
  // check already happened, same division of responsibility already used
  // between LegalGuardianController.assertBelongsToStudent and
  // LegalGuardianService.
  async grantByGuardian(studentPersonId: string, guardianId: string, consentVersion: string): Promise<LocationConsentDecisionEntity> {
    return this.recordDecision({
      subjectPersonId: studentPersonId,
      decision: 'granted',
      decidedByType: 'legal_guardian',
      decidedByPersonId: null,
      decidedByLegalGuardianId: guardianId,
      consentVersion,
    });
  }

  async refuseByGuardian(studentPersonId: string, guardianId: string, consentVersion: string): Promise<LocationConsentDecisionEntity> {
    return this.recordDecision({
      subjectPersonId: studentPersonId,
      decision: 'refused',
      decidedByType: 'legal_guardian',
      decidedByPersonId: null,
      decidedByLegalGuardianId: guardianId,
      consentVersion,
    });
  }

  async revokeByGuardian(studentPersonId: string, guardianId: string): Promise<LocationConsentDecisionEntity> {
    const latest = await this.assertRevocableAndGetLatest(studentPersonId);
    return this.recordDecision({
      subjectPersonId: studentPersonId,
      decision: 'revoked',
      decidedByType: 'legal_guardian',
      decidedByPersonId: null,
      decidedByLegalGuardianId: guardianId,
      consentVersion: latest.consentVersion,
    });
  }

  // "Revoke" only makes sense against an existing GRANTED decision (RULE-
  // PRES-14: "o(a) titular pode revogar este consentimento" — this consent,
  // the one already granted). consentVersion is carried forward from that
  // latest granted row rather than asked of the caller again — same idiom
  // LocationConsentSuspensionService.suspendAndOpenFollowup already uses for
  // the 'system'-revoked path (no new consent text is shown on a revoke
  // action, so there is no new version to record).
  private async assertRevocableAndGetLatest(subjectPersonId: string): Promise<LocationConsentDecisionEntity> {
    const latest = await this.getActiveConsent(subjectPersonId);
    if (!latest || latest.decision !== 'granted') {
      throw new ConflictException(`person ${subjectPersonId} has no active (granted) location consent to revoke`);
    }
    return latest;
  }

  private async recordDecision(input: RecordDecisionInput): Promise<LocationConsentDecisionEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(LocationConsentDecisionEntity);

    return repository.save(
      repository.create({
        tenantId,
        subjectPersonId: input.subjectPersonId,
        decidedByType: input.decidedByType,
        decidedByPersonId: input.decidedByPersonId,
        decidedByLegalGuardianId: input.decidedByLegalGuardianId,
        decision: input.decision,
        consentVersion: input.consentVersion,
      }),
    );
  }
}
