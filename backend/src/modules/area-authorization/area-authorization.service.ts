import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { AreaEntity, WristbandCategoryAreaPermissionEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

// "Serviço de Autorização de Área" (architecture-overview.md — Segurança de
// Intrusão, primeira rodada): pure, read-only decision service implementing
// RULE-ACC-02/RULE-SEC-01's authorization check (wristband category ->
// area/bloco/período permission). RULE-SEC-01's note: no wristband (or no
// category resolved) means unauthorized by default.
//
// Database Agent's flagged gap: area containment is NOT enforced by the
// schema (wristband_category_area_permission.area_id is a single FK, no
// "covers descendants" logic in SQL/constraints) — the `area` table's
// self-referencing hierarchy exists specifically so a bloco-level grant can
// cover its nested areas (AddArea migration's own reasoning), and resolving
// that containment is explicitly left to this service. Implemented by
// walking up from the target area to its ancestors (via parent_area_id) and
// checking whether ANY ancestor-or-self area has a valid permission for the
// category — a permission granted at a parent covers every area nested
// under it, transitively.
@Injectable()
export class AreaAuthorizationService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async isAuthorized(wristbandCategoryId: string | null, areaId: string, atTime: Date): Promise<boolean> {
    // RULE-SEC-01's note: a person with no wristband, or whose category
    // couldn't be resolved, is unauthorized by default — no permission row
    // can ever match a null category.
    if (!wristbandCategoryId) {
      return false;
    }

    const manager = this.tenantContext.getManager();
    const areaAndAncestorIds = await this.resolveAreaAndAncestors(manager, areaId);
    if (areaAndAncestorIds.length === 0) {
      return false;
    }

    const permissions = await manager.getRepository(WristbandCategoryAreaPermissionEntity).find({
      where: { wristbandCategoryId, areaId: In(areaAndAncestorIds) },
    });

    return permissions.some((permission) => this.isValidAt(permission, atTime));
  }

  private isValidAt(permission: WristbandCategoryAreaPermissionEntity, atTime: Date): boolean {
    if (permission.validFrom && atTime < permission.validFrom) {
      return false;
    }
    if (permission.validUntil && atTime > permission.validUntil) {
      return false;
    }
    return true;
  }

  // Walks parent_area_id from the target area up to its root "bloco",
  // returning the target area itself plus every ancestor. A visited-set
  // guard (rather than a fixed depth limit) tolerates any hierarchy depth
  // while still terminating safely if a cycle were ever introduced.
  private async resolveAreaAndAncestors(manager: EntityManager, areaId: string): Promise<string[]> {
    const areaRepository = manager.getRepository(AreaEntity);
    const visited = new Set<string>();
    let currentId: string | null = areaId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      // eslint-disable-next-line no-await-in-loop -- each step depends on the
      // previous one's parent_area_id; the hierarchy is shallow by design
      // (bloco -> área/andar/corredor), so sequential lookups are fine here.
      const area: AreaEntity | null = await areaRepository.findOneBy({ id: currentId });
      currentId = area?.parentAreaId ?? null;
    }

    return Array.from(visited);
  }
}
