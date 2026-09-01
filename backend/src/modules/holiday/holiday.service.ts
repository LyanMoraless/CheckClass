import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Between, EntityManager, QueryFailedError } from 'typeorm';
import { ClassSessionEntity, HolidayEntity } from '../../database/entities';
import { utcDayRange } from '../../common/utc-date.util';
import { TenantContextService } from '../../database/tenant-context.service';

const UNIQUE_VIOLATION = '23505';

export interface CreateHolidayInput {
  // ISO date string ("YYYY-MM-DD"), matching @IsDateString() on the DTO —
  // converted to a Date at the service boundary, same convention already
  // used by ClassGroupService for termStartDate/termEndDate.
  date: string;
  name: string;
}

// RULE-INST-04 (architecture closure, 2026-09-01): a holiday is
// institutional — applies to the whole tenant, never scoped to a room or
// turma. Plain tenant-scoped CRUD: unlike the class-schedule module, there is
// no LeadershipScopeService check here — RULE-INST-09 gates "montar/editar
// turma" specifically (matéria, professor(es), sala, horário/cronograma,
// alunos of ONE turma), and the institutional holiday calendar isn't part of
// that list. MANAGE_INSTITUTION_STRUCTURE alone (checked at the controller)
// is sufficient.
@Injectable()
export class HolidayService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async create(input: CreateHolidayInput): Promise<HolidayEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(HolidayEntity);

    let saved: HolidayEntity;
    try {
      saved = await repository.save(repository.create({ tenantId, date: new Date(input.date), name: input.name }));
    } catch (error) {
      // UNIQUE(tenant_id, date) from the AddHoliday migration: a calendar
      // date either is a holiday for this institution or it isn't — surface
      // that as a clear 409, not a raw DB error.
      if (error instanceof QueryFailedError && (error.driverError as { code?: string } | undefined)?.code === UNIQUE_VIOLATION) {
        throw new ConflictException(`date ${input.date} is already registered as a holiday for this institution`);
      }
      throw error;
    }

    // RULE-INST-04 (third-round update, item #4): a holiday marked AFTER a
    // session was already auto-generated for that same calendar date cancels
    // that session automatically — same "never delete, only mark cancelled"
    // mechanism as ClassSessionService.cancelSession (item #1), preserving
    // any check-in/pending-review history already attached to it. Applies
    // across every turma tenant-wide (holiday is institutional, not
    // scoped), same request transaction as the holiday insert above (tudo-
    // ou-nada — same TenantContextService.runWithTenant reasoning already
    // documented elsewhere in this codebase).
    await this.cancelSessionsOnDate(manager, saved.date);

    return saved;
  }

  async list(): Promise<HolidayEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(HolidayEntity).find({ order: { date: 'ASC' } });
  }

  async delete(id: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(HolidayEntity);
    const holiday = await repository.findOneBy({ id });
    if (!holiday) {
      throw new NotFoundException(`holiday ${id} not found`);
    }
    await repository.delete({ id });
  }

  // Reuses the same date-only <-> timestamptz UTC convention already
  // established by ClassScheduleService/SessionGenerationService (see
  // common/utc-date.util.ts's top-of-file doc for why UTC, not a real
  // "institution timezone", is the convention here) instead of re-deriving
  // it. Between(...) keeps the calendar-day match a single indexed DB-level
  // range query, rather than fetching every class_session for the tenant
  // into memory just to filter one day's worth in application code.
  private async cancelSessionsOnDate(manager: EntityManager, holidayDate: Date): Promise<void> {
    const { start, end } = utcDayRange(holidayDate);
    const sessionRepo = manager.getRepository(ClassSessionEntity);

    const sessionsOnDate = await sessionRepo.find({
      // `end` is the FOLLOWING day's UTC midnight (exclusive upper bound);
      // Between(...) is inclusive on both ends, so subtracting 1ms keeps the
      // range exactly [start-of-day, end-of-day].
      where: { scheduledStart: Between(start, new Date(end.getTime() - 1)) },
    });

    for (const session of sessionsOnDate) {
      if (session.status === 'cancelled') {
        continue;
      }
      await sessionRepo.update({ id: session.id }, { status: 'cancelled' });
    }
  }
}
