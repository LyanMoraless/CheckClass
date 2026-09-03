import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInstitutionOnboardingDto } from './create-institution-onboarding.dto';

// RULE-INST-01: institutionType is a fixed enum (INSTITUTION_TYPES, shared
// with TenantBootstrapService — see that module's own spec for the seeding
// side). This spec covers the other half: the @IsIn(INSTITUTION_TYPES)
// decorator itself, run the same way NestJS's global ValidationPipe runs it
// in production (plainToInstance, then validate) — not just calling
// service.onboard() directly with an already-typed input, which is what
// institution-onboarding.service.spec.ts does and which never exercises this
// decorator at all.
describe('CreateInstitutionOnboardingDto', () => {
  const validPayload = {
    institutionName: 'Faculdade Alfa',
    cnpj: '11.222.333/0001-81',
    institutionType: 'faculdade',
    addressZipCode: '01310-100',
    addressStreet: 'Av. Paulista',
    addressNumber: '1000',
    addressNeighborhood: 'Bela Vista',
    addressCity: 'São Paulo',
    addressState: 'SP',
    rootFullName: 'Root Admin',
    rootCpf: '11122233344',
    rootPassword: 'a strong root password',
  };

  async function validateInstitutionType(institutionType: unknown) {
    const dto = plainToInstance(CreateInstitutionOnboardingDto, { ...validPayload, institutionType });
    const errors = await validate(dto);
    return errors.filter((error) => error.property === 'institutionType');
  }

  test.each(['faculdade', 'escola'])(
    'test_institutionType_%s_isAccepted_noValidationError',
    async (institutionType) => {
      const errors = await validateInstitutionType(institutionType);

      expect(errors).toHaveLength(0);
    },
  );

  // The exact regression this spec exists to catch: "empresa" was a valid
  // institutionType before RULE-INST-01 narrowed the enum to 2 values, and
  // must now be rejected by the DTO layer (422 via the global ValidationPipe
  // in production) rather than silently accepted and passed on to
  // TenantBootstrapService.
  test('test_institutionType_empresa_rejected_isInStillListsItAsRemoved', async () => {
    const errors = await validateInstitutionType('empresa');

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isIn');
  });

  test('test_institutionType_arbitraryString_rejected', async () => {
    const errors = await validateInstitutionType('universidade');

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isIn');
  });

  test('test_institutionType_emptyString_rejected', async () => {
    const errors = await validateInstitutionType('');

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isIn');
  });

  test('test_institutionType_missing_rejected', async () => {
    const { institutionType: _omit, ...payloadWithoutType } = validPayload;
    const dto = plainToInstance(CreateInstitutionOnboardingDto, payloadWithoutType);

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'institutionType')).toBe(true);
  });

  test('test_fullValidPayload_faculdade_producesNoValidationErrors', async () => {
    const dto = plainToInstance(CreateInstitutionOnboardingDto, validPayload);

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
