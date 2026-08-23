import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CameraEntity, IntrusionIncidentEntity, IntrusionIncidentLocationEntryEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

export type SecurityIncidentOutcome = 'resolved' | 'false_positive';

export interface SecurityIncidentDetail {
  incident: IntrusionIncidentEntity;
  locationHistory: IntrusionIncidentLocationEntryEntity[];
  // RULE-SEC-03's camera auto-follow, from the polling client's perspective:
  // the camera (if any) whose area matches the incident's current estimated
  // area. The frontend polls GET /:id and puts this camera in fullscreen,
  // re-polling as current_area_id (and therefore this field) changes.
  suggestedCameraId: string | null;
}

// "Registro/Consulta de Alertas de Segurança" (architecture-overview.md):
// read side + RULE-SEC-07's closure lifecycle, structurally the closest
// precedent being PendingReviewService's open -> closed workflow (per that
// rule's own comparison note) — but its own, separate mechanism: flat
// authorization (any manage_security_incidents holder, no leadership chain)
// and a mandatory note on every closure, enforced here at the service layer.
@Injectable()
export class SecurityIncidentService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async list(status?: string): Promise<IntrusionIncidentEntity[]> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(IntrusionIncidentEntity);
    return status ? repository.find({ where: { status }, order: { openedAt: 'DESC' } }) : repository.find({ order: { openedAt: 'DESC' } });
  }

  async getById(incidentId: string): Promise<SecurityIncidentDetail> {
    const manager = this.tenantContext.getManager();

    const incident = await manager.getRepository(IntrusionIncidentEntity).findOneBy({ id: incidentId });
    if (!incident) {
      throw new NotFoundException(`intrusion_incident ${incidentId} not found`);
    }

    const locationHistory = await manager.getRepository(IntrusionIncidentLocationEntryEntity).find({
      where: { intrusionIncidentId: incidentId },
      order: { detectedAt: 'ASC' },
    });

    let suggestedCameraId: string | null = null;
    if (incident.currentAreaId) {
      // No documented tie-break rule when more than one active camera exists
      // in the same area — findOneBy returns whichever row Postgres happens
      // to return first (no ORDER BY), which is effectively arbitrary and
      // may not be stable across calls. Fine today (RULE-SEC-03 doesn't
      // specify a preference among co-located cameras), but worth knowing if
      // this field ever "flips" between polls with no area change.
      const camera = await manager.getRepository(CameraEntity).findOneBy({ areaId: incident.currentAreaId, status: 'active' });
      suggestedCameraId = camera?.id ?? null;
    }

    return { incident, locationHistory, suggestedCameraId };
  }

  async close(incidentId: string, closingPersonId: string, outcome: SecurityIncidentOutcome, note: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(IntrusionIncidentEntity);

    const incident = await repository.findOneBy({ id: incidentId });
    if (!incident) {
      throw new NotFoundException(`intrusion_incident ${incidentId} not found`);
    }

    // RULE-SEC-07's double-closure guard is enforced by this UPDATE's WHERE
    // clause (status = 'open'), not by the read above — two concurrent close
    // requests both reading status = 'open' before either writes could
    // otherwise both pass an application-level "if status !== 'closed'"
    // check and the second would silently overwrite the first's
    // outcome/note/closer (a TOCTOU race). Making the update itself
    // conditional, and checking affected rows, means only one of the two can
    // ever actually close it — the other reliably gets "already closed"
    // regardless of read timing. Same guard PendingReviewService.resolve()
    // applies to double resolution in spirit, but that one isn't exposed to
    // this same race shape.
    const result = await repository.update(
      { id: incidentId, status: 'open' },
      {
        status: 'closed',
        outcome,
        resolutionNote: note,
        closedByPersonId: closingPersonId,
        closedAt: new Date(),
      },
    );
    if (result.affected === 0) {
      throw new BadRequestException('This intrusion incident has already been closed');
    }
  }
}
