import { ForbiddenException, Injectable } from '@nestjs/common';
import { DeviceBindingConfigEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';

// ---------------------------------------------------------------------------
// BACKEND AGENT DECISION (explicitly left open by the task handoff — not a
// business rule, documented here per instruction): what happens when a
// tenant has never created a device_binding_config row (no
// inactivityTimeoutMinutes set)?
//
// Chosen: a documented HARDCODED DEFAULT (30 minutes), applied only as a
// fallback for the read side — device_binding creation is NEVER blocked by a
// missing config row (rejected the fail-closed alternative).
//
// Why not fail-closed ("o fator nunca conta até configurar")? RULE-DEV-12
// makes the DEVICE_BINDING attendance factor opt-in per tenant through a
// TOTALLY SEPARATE config table (attendance_config_required_factor). A
// tenant can mark the factor required there while never touching this
// unrelated "higiene de sessão" config (Solution Architect's own framing:
// "domínios diferentes: higiene de sessão vs. política de apuração"). If
// binding CREATION itself were blocked without a device_binding_config row,
// a tenant that marked the factor required but never configured this table
// would get a structurally impossible-to-satisfy factor — every session/
// person permanently pending (RULE-ATT-07/11), un-resolvable short of
// support intervention, for a config the institution may not even know
// exists yet. That is a worse failure mode than a generic default.
//
// Why 30 minutes is low-stakes even if never tuned: this value only feeds
// gatilho 3 (inactivity timeout), one of RULE-DEV-06's four checkout
// triggers — logout/session_end/token_expired keep working independently of
// it. RULE-DEV-11 already guarantees an imprecise or late inactivity
// checkout never corrupts permanência (the login→checkout interval never
// counts toward it), so a generic default causing an occasional
// too-early/too-late checkout has no correctness impact on the chamada
// itself, only on how promptly RULE-DEV-07's "one active binding" frees up.
// ---------------------------------------------------------------------------
export const DEFAULT_INACTIVITY_TIMEOUT_MINUTES = 30;

export interface EffectiveDeviceBindingConfig {
  inactivityTimeoutMinutes: number;
  // Lets the frontend/admin screen distinguish "this is the hardcoded
  // fallback, please configure it" from "this is what the institution
  // actually chose" without a second round trip.
  isDefault: boolean;
}

@Injectable()
export class DeviceBindingConfigService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly leadershipScope: LeadershipScopeService,
  ) {}

  async getEffective(): Promise<EffectiveDeviceBindingConfig> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const config = await manager.getRepository(DeviceBindingConfigEntity).findOneBy({ tenantId });
    if (!config) {
      return { inactivityTimeoutMinutes: DEFAULT_INACTIVITY_TIMEOUT_MINUTES, isDefault: true };
    }
    return { inactivityTimeoutMinutes: config.inactivityTimeoutMinutes, isDefault: false };
  }

  // Not dictated by any RULE-DEV rule (this table's write path wasn't named
  // in the handoff at all) — gated by the same Direção/Reitoria authority as
  // RULE-DEV-15's inventory administration, the closest existing authority
  // this session-hygiene setting belongs under, rather than
  // CONFIGURE_ATTENDANCE_RULES (the Solution Architect was explicit this is
  // a different domain from attendance policy).
  async upsert(inactivityTimeoutMinutes: number, requesterPersonId: string): Promise<DeviceBindingConfigEntity> {
    const scope = await this.leadershipScope.getCourseScope(requesterPersonId);
    if (!scope.allCourses) {
      throw new ForbiddenException(`Person ${requesterPersonId} has no Direção/Reitoria authority to configure device_binding_config`);
    }

    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(DeviceBindingConfigEntity);

    const existing = await repository.findOneBy({ tenantId });
    if (existing) {
      await repository.update({ id: existing.id }, { inactivityTimeoutMinutes });
      return repository.findOneByOrFail({ id: existing.id });
    }
    return repository.save(repository.create({ tenantId, inactivityTimeoutMinutes }));
  }
}
