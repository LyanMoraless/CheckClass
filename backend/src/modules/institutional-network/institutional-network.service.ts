import { Injectable } from '@nestjs/common';
import * as ipaddr from 'ipaddr.js';
import { InstitutionalNetworkRangeEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

// GAP-10 (RULE-DEV-14) — "Decisão de tecnologia — Detecção de rede
// institucional / GAP-10 (2026-09-11)"
// (project-knowledge/references/architecture-overview.md). Shared, stateless
// decision primitive — called explicitly from two places, NEVER wired as a
// guard/middleware global (the Tech Decision's own wording): (1)
// DeviceBindingService.createBinding (Frente 12, wired this round — see that
// service's own comment at the call site); (2) the future Frente 13
// login-decision flow (not built yet — this service is kept generic/
// reusable for that, nothing facial-specific lives here).
//
// Match strategy: ipaddr.js (the Tech Decision's approved library) compares
// the request's source IP against every CIDR range registered for the
// tenant. institutional_network_range is N rows per tenant (unlike
// device_binding_config's one-row-per-tenant shape) — an institution can
// have more than one range in play (main building + annex, academic Wi-Fi
// vs. guest Wi-Fi), so every configured range must be checked, not just the
// first one found.
@Injectable()
export class InstitutionalNetworkService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async isWithinInstitutionalNetwork(tenantId: string, sourceIp: string): Promise<boolean> {
    const manager = this.tenantContext.getManager();
    const ranges = await manager.getRepository(InstitutionalNetworkRangeEntity).findBy({ tenantId });

    // Tech Decision's explicit default (2026-09-11): a tenant that never
    // configured any range is treated as OUTSIDE the network — nunca trava
    // ninguém por ausência de config. What "outside" means is entirely up to
    // the caller (createBinding blocks; a future facial-login flow would
    // just never require facial) — this primitive only ever answers the
    // yes/no location question.
    if (ranges.length === 0) {
      return false;
    }

    let sourceAddress: ipaddr.IPv4 | ipaddr.IPv6;
    try {
      // process() (not parse()) also folds an IPv4-mapped IPv6 address (e.g.
      // "::ffff:203.0.113.7", which a dual-stack socket can hand back as
      // req.ip) down to plain IPv4 — matching it against an IPv4 CIDR range
      // would otherwise always fail on the kind() mismatch guard below.
      sourceAddress = ipaddr.process(sourceIp);
    } catch {
      // Malformed/unparseable source IP can never prove "inside the
      // network" — same fail-closed posture as the no-ranges-configured
      // default above, never the opposite.
      return false;
    }

    return ranges.some((range) => this.matchesRange(sourceAddress, range.cidr));
  }

  private matchesRange(sourceAddress: ipaddr.IPv4 | ipaddr.IPv6, cidr: string): boolean {
    try {
      const [rangeAddress, prefixLength] = ipaddr.parseCIDR(cidr);
      // ipaddr.js's match() THROWS (rather than returning false) when
      // comparing across address families — an IPv4 source can never be
      // "inside" an IPv6 range and vice versa, so skipping here is a
      // legitimate non-match, not an error condition.
      if (sourceAddress.kind() !== rangeAddress.kind()) {
        return false;
      }
      return sourceAddress.match(rangeAddress, prefixLength);
    } catch {
      // Defensive only: institutional_network_range.cidr is Postgres' native
      // `cidr` column type, which already rejects malformed CIDR notation at
      // write time (AddInstitutionalNetworkRange migration) — this branch
      // should be unreachable in practice. One corrupt/unreadable row must
      // never throw and block every OTHER configured range from being
      // checked.
      return false;
    }
  }
}
