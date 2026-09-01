import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ClassSessionEntity, HolidayEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { CreateHolidayInput, HolidayService } from './holiday.service';

// RULE-INST-04 (architecture closure): holiday is institutional, tenant-
// scoped only, UNIQUE(tenant_id, date) from the AddHoliday migration.
describe('HolidayService', () => {
  const input: CreateHolidayInput = { date: '2026-12-25', name: 'Natal' };

  function buildService(options: { holidayRepo?: MockRepository; sessionRepo?: MockRepository } = {}) {
    const holidayRepo =
      options.holidayRepo ?? createMockRepository({ save: jest.fn().mockResolvedValue({ date: new Date('2026-12-25'), name: 'Natal' }) });
    const sessionRepo = options.sessionRepo ?? createMockRepository({ find: jest.fn().mockResolvedValue([]) });
    const manager = createMockEntityManager(
      new Map([
        [HolidayEntity, holidayRepo],
        [ClassSessionEntity, sessionRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const service = new HolidayService(tenantContext as never);
    return { service, holidayRepo, sessionRepo };
  }

  describe('create', () => {
    test('test_create_savesHolidayWithTenantIdAndParsedDate', async () => {
      const { service, holidayRepo } = buildService();

      await service.create(input);

      expect(holidayRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-a-id', date: new Date('2026-12-25'), name: 'Natal' }),
      );
    });

    test('test_create_duplicateDateForTenant_throwsConflictNotRawDbError', async () => {
      const duplicateError = Object.assign(new QueryFailedError('insert', [], new Error('duplicate key')), {
        driverError: { code: '23505' },
      });
      const holidayRepo = createMockRepository({ save: jest.fn().mockRejectedValue(duplicateError) });
      const { service } = buildService({ holidayRepo });

      await expect(service.create(input)).rejects.toThrow(ConflictException);
    });

    test('test_create_unrelatedDbError_rethrowsAsIs', async () => {
      const otherError = new Error('connection lost');
      const holidayRepo = createMockRepository({ save: jest.fn().mockRejectedValue(otherError) });
      const { service } = buildService({ holidayRepo });

      await expect(service.create(input)).rejects.toThrow(otherError);
    });

    // RULE-INST-04 (third-round update, item #4).
    describe('cancels already-generated sessions on the same calendar date', () => {
      test('test_create_sessionAlreadyGeneratedOnHolidayDate_getsCancelled', async () => {
        const sessionOnDate = { id: 'session-1', status: 'scheduled', scheduledStart: new Date('2026-12-25T13:00:00Z') };
        const sessionRepo = createMockRepository({ find: jest.fn().mockResolvedValue([sessionOnDate]) });
        const { service, sessionRepo: repo } = buildService({ sessionRepo });

        await service.create(input);

        expect(repo.update).toHaveBeenCalledWith({ id: 'session-1' }, { status: 'cancelled' });
      });

      test('test_create_queriesSessionsWithinTheHolidaysUtcCalendarDayRange', async () => {
        const { service, sessionRepo } = buildService();

        await service.create(input);

        const findCall = sessionRepo.find.mock.calls[0][0];
        expect(findCall.where.scheduledStart.type).toBe('between');
        expect(findCall.where.scheduledStart.value).toEqual([
          new Date('2026-12-25T00:00:00.000Z'),
          new Date('2026-12-25T23:59:59.999Z'),
        ]);
      });

      test('test_create_editedSessionOnHolidayDate_alsoGetsCancelled', async () => {
        const sessionOnDate = { id: 'session-1', status: 'edited', scheduledStart: new Date('2026-12-25T13:00:00Z') };
        const sessionRepo = createMockRepository({ find: jest.fn().mockResolvedValue([sessionOnDate]) });
        const { service, sessionRepo: repo } = buildService({ sessionRepo });

        await service.create(input);

        expect(repo.update).toHaveBeenCalledWith({ id: 'session-1' }, { status: 'cancelled' });
      });

      test('test_create_alreadyCancelledSessionOnHolidayDate_isNotUpdatedAgain', async () => {
        const sessionOnDate = { id: 'session-1', status: 'cancelled', scheduledStart: new Date('2026-12-25T13:00:00Z') };
        const sessionRepo = createMockRepository({ find: jest.fn().mockResolvedValue([sessionOnDate]) });
        const { service, sessionRepo: repo } = buildService({ sessionRepo });

        await service.create(input);

        expect(repo.update).not.toHaveBeenCalled();
      });

      test('test_create_noSessionsOnHolidayDate_doesNotTouchUpdate', async () => {
        const { service, sessionRepo } = buildService();

        await service.create(input);

        expect(sessionRepo.update).not.toHaveBeenCalled();
      });

      test('test_create_duplicateHolidayDate_neverQueriesOrCancelsSessions', async () => {
        const duplicateError = Object.assign(new QueryFailedError('insert', [], new Error('duplicate key')), {
          driverError: { code: '23505' },
        });
        const holidayRepo = createMockRepository({ save: jest.fn().mockRejectedValue(duplicateError) });
        const { service, sessionRepo } = buildService({ holidayRepo });

        await expect(service.create(input)).rejects.toThrow(ConflictException);
        expect(sessionRepo.find).not.toHaveBeenCalled();
      });
    });
  });

  test('test_list_returnsHolidaysOrderedByDateAscending', async () => {
    const holidays = [{ id: 'holiday-1' }];
    const holidayRepo = createMockRepository({ find: jest.fn().mockResolvedValue(holidays) });
    const { service } = buildService({ holidayRepo });

    const result = await service.list();

    expect(result).toBe(holidays);
    expect(holidayRepo.find).toHaveBeenCalledWith({ order: { date: 'ASC' } });
  });

  describe('delete', () => {
    test('test_delete_holidayExists_deletesById', async () => {
      const holidayRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'holiday-1' }) });
      const { service } = buildService({ holidayRepo });

      await service.delete('holiday-1');

      expect(holidayRepo.delete).toHaveBeenCalledWith({ id: 'holiday-1' });
    });

    test('test_delete_holidayNotFound_throwsNotFoundWithoutDeleting', async () => {
      const holidayRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ holidayRepo });

      await expect(service.delete('missing-holiday')).rejects.toThrow(NotFoundException);
      expect(holidayRepo.delete).not.toHaveBeenCalled();
    });
  });
});
