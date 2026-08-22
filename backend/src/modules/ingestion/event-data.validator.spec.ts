import { UnprocessableEntityException } from '@nestjs/common';
import { IngestionEventType } from './dto/ingestion-event-type.enum';
import { validateEventData } from './event-data.validator';

// RULE-ATT-01/06/13: required data shape depends on eventType (structural
// envelope validation is handled elsewhere, by the global ValidationPipe).
describe('validateEventData', () => {
  test('test_validateEventData_tagCheckinWithTagCode_doesNotThrow', () => {
    expect(() => validateEventData(IngestionEventType.TAG_CHECKIN, { tagCode: 'TAG-123' })).not.toThrow();
  });

  test('test_validateEventData_tagCheckinMissingTagCode_throwsUnprocessableEntity', () => {
    expect(() => validateEventData(IngestionEventType.TAG_CHECKIN, {})).toThrow(UnprocessableEntityException);
  });

  test('test_validateEventData_tagCheckinWithEmptyStringTagCode_throwsUnprocessableEntity', () => {
    expect(() => validateEventData(IngestionEventType.TAG_CHECKIN, { tagCode: '' })).toThrow(UnprocessableEntityException);
  });

  test('test_validateEventData_roomEntryRequiresTagCode_sameAsTagCheckin', () => {
    expect(() => validateEventData(IngestionEventType.ROOM_ENTRY, { tagCode: 'TAG-123' })).not.toThrow();
    expect(() => validateEventData(IngestionEventType.ROOM_ENTRY, {})).toThrow(UnprocessableEntityException);
  });

  test('test_validateEventData_roomExitRequiresTagCode_sameAsTagCheckin', () => {
    expect(() => validateEventData(IngestionEventType.ROOM_EXIT, { tagCode: 'TAG-123' })).not.toThrow();
    expect(() => validateEventData(IngestionEventType.ROOM_EXIT, {})).toThrow(UnprocessableEntityException);
  });

  test('test_validateEventData_facialCheckinWithMatchReferenceAndConfidence_doesNotThrow', () => {
    expect(() =>
      validateEventData(IngestionEventType.FACIAL_CHECKIN, { matchReference: 'local-ref-1', confidence: 0.92 }),
    ).not.toThrow();
  });

  test('test_validateEventData_facialCheckinMissingConfidence_throwsUnprocessableEntity', () => {
    expect(() => validateEventData(IngestionEventType.FACIAL_CHECKIN, { matchReference: 'local-ref-1' })).toThrow(
      UnprocessableEntityException,
    );
  });

  test('test_validateEventData_facialCheckinWithNaNConfidence_throwsUnprocessableEntity', () => {
    expect(() =>
      validateEventData(IngestionEventType.FACIAL_CHECKIN, { matchReference: 'local-ref-1', confidence: NaN }),
    ).toThrow(UnprocessableEntityException);
  });

  test('test_validateEventData_facialCheckinMissingMatchReference_throwsUnprocessableEntity', () => {
    expect(() => validateEventData(IngestionEventType.FACIAL_CHECKIN, { confidence: 0.5 })).toThrow(
      UnprocessableEntityException,
    );
  });

  test('test_validateEventData_cameraCountWithNumericCount_doesNotThrow', () => {
    expect(() => validateEventData(IngestionEventType.CAMERA_COUNT, { count: 12 })).not.toThrow();
  });

  test('test_validateEventData_cameraCountWithZeroCount_doesNotThrow', () => {
    // Boundary: zero is a valid (falsy but present) count, not "missing".
    expect(() => validateEventData(IngestionEventType.CAMERA_COUNT, { count: 0 })).not.toThrow();
  });

  test('test_validateEventData_cameraCountWithStringCount_throwsUnprocessableEntity', () => {
    expect(() => validateEventData(IngestionEventType.CAMERA_COUNT, { count: '12' })).toThrow(
      UnprocessableEntityException,
    );
  });

  test('test_validateEventData_customEventWithFactorCode_doesNotThrow', () => {
    // RULE-ATT-13: institution-defined custom factor code, loose by design.
    expect(() => validateEventData(IngestionEventType.CUSTOM, { factorCode: 'FINGERPRINT_SCAN' })).not.toThrow();
  });

  test('test_validateEventData_customEventMissingFactorCode_throwsUnprocessableEntity', () => {
    expect(() => validateEventData(IngestionEventType.CUSTOM, {})).toThrow(UnprocessableEntityException);
  });
});
