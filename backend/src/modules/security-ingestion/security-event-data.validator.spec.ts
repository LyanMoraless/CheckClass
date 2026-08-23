import { UnprocessableEntityException } from '@nestjs/common';
import { SecurityIngestionEventType } from './security-ingestion-event-type.enum';
import { validateSecurityEventData } from './security-event-data.validator';

describe('validateSecurityEventData', () => {
  test('test_validateSecurityEventData_areaReaderScanWithTagCode_doesNotThrow', () => {
    expect(() =>
      validateSecurityEventData(SecurityIngestionEventType.AREA_READER_SCAN, { tagCode: 'TAG-123' }),
    ).not.toThrow();
  });

  test('test_validateSecurityEventData_areaReaderScanMissingTagCode_throwsUnprocessableEntity', () => {
    expect(() => validateSecurityEventData(SecurityIngestionEventType.AREA_READER_SCAN, {})).toThrow(
      UnprocessableEntityException,
    );
  });

  test('test_validateSecurityEventData_areaReaderScanWithUnexpectedKey_throwsUnprocessableEntity', () => {
    expect(() =>
      validateSecurityEventData(SecurityIngestionEventType.AREA_READER_SCAN, { tagCode: 'TAG-123', extra: 'nope' }),
    ).toThrow(UnprocessableEntityException);
  });

  test('test_validateSecurityEventData_irBarrierCrossingWithEmptyData_doesNotThrow', () => {
    // Anonymous by nature — an empty object is the expected shape.
    expect(() => validateSecurityEventData(SecurityIngestionEventType.IR_BARRIER_CROSSING, {})).not.toThrow();
  });

  test('test_validateSecurityEventData_irBarrierCrossingWithAnyKey_throwsUnprocessableEntity', () => {
    // No identity data is ever allowed to ride along on a beam-break event.
    expect(() =>
      validateSecurityEventData(SecurityIngestionEventType.IR_BARRIER_CROSSING, { tagCode: 'TAG-123' }),
    ).toThrow(UnprocessableEntityException);
  });
});
