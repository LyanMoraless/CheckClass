import {
  AttendanceConfigEntity,
  AttendanceConfigRequiredFactorEntity,
  AttendanceFactorTypeEntity,
  ClassGroupEntity,
  SubjectEntity,
} from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { ConfigScopeType } from './config-scope-type.enum';
import { PostToleranceBehavior } from './post-tolerance-behavior.enum';
import { TenantConfigService } from './tenant-config.service';

// RULE-ATT-02/04/05/13: config cascade institution -> course -> class_group
// (most specific wins). RULE-ATT-14: post_tolerance_behavior restricted to
// exactly 3 fixed values, not extensible by the institution.
describe('TenantConfigService', () => {
  const classGroup: ClassGroupEntity = {
    id: 'class-group-1',
    tenantId: 'tenant-a-id',
    subjectId: 'subject-1',
    name: 'Turma A',
    roomId: null,
    termStartDate: null,
    termEndDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const subject: SubjectEntity = {
    id: 'subject-1',
    tenantId: 'tenant-a-id',
    courseId: 'course-1',
    name: 'Cálculo I',
    code: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function buildService(options: {
    classGroupConfig?: unknown;
    courseConfig?: unknown;
    institutionConfig?: unknown;
    requiredFactors?: Array<{ attendanceFactorTypeId: string }>;
    classGroupRepo?: MockRepository;
    subjectRepo?: MockRepository;
    configRepo?: MockRepository;
    factorTypeRepo?: MockRepository;
  }) {
    const classGroupRepo =
      options.classGroupRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue(classGroup) });
    const subjectRepo =
      options.subjectRepo ?? createMockRepository({ findOneByOrFail: jest.fn().mockResolvedValue(subject) });
    const configRepo =
      options.configRepo ??
      createMockRepository({
        findOneBy: jest
          .fn()
          .mockResolvedValueOnce(options.classGroupConfig ?? null)
          .mockResolvedValueOnce(options.courseConfig ?? null)
          .mockResolvedValueOnce(options.institutionConfig ?? null),
      });
    const requiredFactorRepo = createMockRepository({ findBy: jest.fn().mockResolvedValue(options.requiredFactors ?? []) });
    const factorTypeRepo = options.factorTypeRepo ?? createMockRepository();

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [ClassGroupEntity, classGroupRepo],
      [SubjectEntity, subjectRepo],
      [AttendanceConfigEntity, configRepo],
      [AttendanceConfigRequiredFactorEntity, requiredFactorRepo],
      [AttendanceFactorTypeEntity, factorTypeRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager);
    const service = new TenantConfigService(tenantContext as never);
    return { service, classGroupRepo, subjectRepo, configRepo, requiredFactorRepo, factorTypeRepo };
  }

  test('test_resolveEffectiveConfig_classGroupSpecificConfigWins_overCourseAndInstitution', async () => {
    const { service, configRepo } = buildService({
      classGroupConfig: { id: 'config-class-group', minAttendancePercentage: 90, toleranceMinutes: 5, postToleranceBehavior: 'block_checkin' },
      courseConfig: { id: 'config-course', minAttendancePercentage: 80, toleranceMinutes: 10, postToleranceBehavior: 'deny_presence' },
      institutionConfig: { id: 'config-institution', minAttendancePercentage: 75, toleranceMinutes: 20, postToleranceBehavior: 'register_only' },
    });

    const result = await service.resolveEffectiveConfig(classGroup.id);

    expect(result.configId).toBe('config-class-group');
    expect(result.minAttendancePercentage).toBe(90);
    expect(configRepo.findOneBy).toHaveBeenCalledTimes(1);
  });

  test('test_resolveEffectiveConfig_courseConfigWins_whenNoClassGroupConfig', async () => {
    const { service } = buildService({
      classGroupConfig: null,
      courseConfig: { id: 'config-course', minAttendancePercentage: 80, toleranceMinutes: 10, postToleranceBehavior: 'deny_presence' },
      institutionConfig: { id: 'config-institution', minAttendancePercentage: 75, toleranceMinutes: 20, postToleranceBehavior: 'register_only' },
    });

    const result = await service.resolveEffectiveConfig(classGroup.id);

    expect(result.configId).toBe('config-course');
  });

  test('test_resolveEffectiveConfig_institutionConfigUsed_whenNoMoreSpecificConfig', async () => {
    const { service } = buildService({
      classGroupConfig: null,
      courseConfig: null,
      institutionConfig: { id: 'config-institution', minAttendancePercentage: 75, toleranceMinutes: 20, postToleranceBehavior: 'register_only' },
    });

    const result = await service.resolveEffectiveConfig(classGroup.id);

    expect(result.configId).toBe('config-institution');
  });

  test('test_resolveEffectiveConfig_throwsUnprocessableEntity_whenNoConfigFoundAtAnyLevel', async () => {
    const { service } = buildService({ classGroupConfig: null, courseConfig: null, institutionConfig: null });

    await expect(service.resolveEffectiveConfig(classGroup.id)).rejects.toThrow(/No attendance_config found/);
  });

  test('test_resolveEffectiveConfig_throwsNotFound_whenClassGroupDoesNotExist', async () => {
    const classGroupRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service } = buildService({ classGroupRepo });

    await expect(service.resolveEffectiveConfig('missing-class-group')).rejects.toThrow(/not found/);
  });

  test('test_resolveEffectiveConfig_includesRequiredFactorIds', async () => {
    const { service } = buildService({
      institutionConfig: { id: 'config-institution', minAttendancePercentage: 75, toleranceMinutes: 20, postToleranceBehavior: 'register_only' },
      requiredFactors: [{ attendanceFactorTypeId: 'factor-1' }, { attendanceFactorTypeId: 'factor-2' }],
    });

    const result = await service.resolveEffectiveConfig(classGroup.id);

    expect(result.requiredFactorTypeIds).toEqual(['factor-1', 'factor-2']);
  });

  test('test_upsertConfig_rejectsInvalidPostToleranceBehavior', async () => {
    // RULE-ATT-14: exactly 3 fixed values, not extensible per-institution.
    const { service } = buildService({});

    await expect(
      service.upsertConfig({
        scopeType: ConfigScopeType.INSTITUTION,
        scopeId: null,
        minAttendancePercentage: 75,
        toleranceMinutes: 20,
        postToleranceBehavior: 'allow_late_forever' as PostToleranceBehavior,
      }),
    ).rejects.toThrow(/postToleranceBehavior must be one of/);
  });

  test('test_upsertConfig_rejectsPercentageAboveOneHundred', async () => {
    const { service } = buildService({});

    await expect(
      service.upsertConfig({
        scopeType: ConfigScopeType.INSTITUTION,
        scopeId: null,
        minAttendancePercentage: 101,
        toleranceMinutes: 20,
        postToleranceBehavior: PostToleranceBehavior.REGISTER_ONLY,
      }),
    ).rejects.toThrow(/between 0 and 100/);
  });

  test('test_upsertConfig_rejectsNegativePercentage', async () => {
    const { service } = buildService({});

    await expect(
      service.upsertConfig({
        scopeType: ConfigScopeType.INSTITUTION,
        scopeId: null,
        minAttendancePercentage: -1,
        toleranceMinutes: 20,
        postToleranceBehavior: PostToleranceBehavior.REGISTER_ONLY,
      }),
    ).rejects.toThrow(/between 0 and 100/);
  });

  test('test_upsertConfig_rejectsNegativeTolerance', async () => {
    const { service } = buildService({});

    await expect(
      service.upsertConfig({
        scopeType: ConfigScopeType.INSTITUTION,
        scopeId: null,
        minAttendancePercentage: 75,
        toleranceMinutes: -5,
        postToleranceBehavior: PostToleranceBehavior.REGISTER_ONLY,
      }),
    ).rejects.toThrow(/toleranceMinutes must be/);
  });

  test('test_upsertConfig_rejectsMissingScopeId_forNonInstitutionScope', async () => {
    const { service } = buildService({});

    await expect(
      service.upsertConfig({
        scopeType: ConfigScopeType.COURSE,
        scopeId: null,
        minAttendancePercentage: 75,
        toleranceMinutes: 20,
        postToleranceBehavior: PostToleranceBehavior.REGISTER_ONLY,
      }),
    ).rejects.toThrow(/scopeId is required/);
  });

  test('test_upsertConfig_updatesExistingConfig_whenOneAlreadyExistsForScope', async () => {
    const configRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValueOnce({ id: 'existing-config-id' }),
      findOneByOrFail: jest.fn().mockResolvedValue({ id: 'existing-config-id', minAttendancePercentage: 80 }),
    });
    const { service } = buildService({ configRepo });

    const result = await service.upsertConfig({
      scopeType: ConfigScopeType.INSTITUTION,
      scopeId: null,
      minAttendancePercentage: 80,
      toleranceMinutes: 15,
      postToleranceBehavior: PostToleranceBehavior.BLOCK_CHECKIN,
    });

    expect(configRepo.update).toHaveBeenCalledWith(
      { id: 'existing-config-id' },
      expect.objectContaining({ minAttendancePercentage: 80, toleranceMinutes: 15 }),
    );
    expect(configRepo.save).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'existing-config-id', minAttendancePercentage: 80 });
  });

  test('test_upsertConfig_createsNewConfig_whenNoneExistsForScope', async () => {
    const configRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValueOnce(null) });
    const { service } = buildService({ configRepo });

    await service.upsertConfig({
      scopeType: ConfigScopeType.INSTITUTION,
      scopeId: null,
      minAttendancePercentage: 75,
      toleranceMinutes: 20,
      postToleranceBehavior: PostToleranceBehavior.REGISTER_ONLY,
    });

    expect(configRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ scopeType: ConfigScopeType.INSTITUTION, minAttendancePercentage: 75 }),
    );
    expect(configRepo.update).not.toHaveBeenCalled();
  });

  test('test_listConfigs_returnsAllConfigsForTenant', async () => {
    const configRows = [{ id: 'config-1' }, { id: 'config-2' }];
    const configRepo = createMockRepository({ find: jest.fn().mockResolvedValue(configRows) });
    const { service } = buildService({ configRepo });

    const result = await service.listConfigs();

    expect(result).toBe(configRows);
    expect(configRepo.find).toHaveBeenCalledWith({ order: { scopeType: 'ASC' } });
  });

  test('test_listConfigs_noneConfigured_returnsEmptyArray', async () => {
    const { service } = buildService({});

    const result = await service.listConfigs();

    expect(result).toEqual([]);
  });

  test('test_listFactorTypes_returnsAllFactorTypesOrderedByName', async () => {
    const factorTypeRows = [{ id: 'factor-1', name: 'ROOM_ENTRY' }];
    const factorTypeRepo = createMockRepository({ find: jest.fn().mockResolvedValue(factorTypeRows) });
    const { service } = buildService({ factorTypeRepo });

    const result = await service.listFactorTypes();

    expect(result).toBe(factorTypeRows);
    expect(factorTypeRepo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
  });
});
