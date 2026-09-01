import { isValidCnpj, stripCnpjMask } from './cnpj.util';

describe('cnpj.util', () => {
  describe('isValidCnpj', () => {
    // Both hand-verified against the official Receita Federal check-digit
    // algorithm (weights 5,4,3,2,9,8,7,6,5,4,3,2 then 6,5,4,3,2,9,8,7,6,5,4,3,2,
    // mod 11, remainder<2 => 0 else 11-remainder) — not copied from an
    // external "known valid CNPJ" list without independent verification.
    test('test_isValidCnpj_unmaskedKnownValidCnpj_returnsTrue', () => {
      expect(isValidCnpj('11222333000181')).toBe(true);
    });

    test('test_isValidCnpj_secondUnmaskedKnownValidCnpj_returnsTrue', () => {
      expect(isValidCnpj('12345678000195')).toBe(true);
    });

    test('test_isValidCnpj_maskedKnownValidCnpj_returnsTrue', () => {
      expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    });

    test('test_isValidCnpj_wrongFirstCheckDigit_returnsFalse', () => {
      expect(isValidCnpj('11222333000171')).toBe(false);
    });

    test('test_isValidCnpj_wrongSecondCheckDigit_returnsFalse', () => {
      expect(isValidCnpj('11222333000180')).toBe(false);
    });

    test('test_isValidCnpj_allSameDigitPassesRawChecksumMath_stillReturnsFalse', () => {
      // 0 * any weight sums to 0 => both check digits would compute to 0,
      // mathematically "passing" the raw formula — the explicit repeated-
      // digit exclusion in the implementation is what rejects it.
      expect(isValidCnpj('00000000000000')).toBe(false);
      expect(isValidCnpj('11111111111111')).toBe(false);
    });

    test('test_isValidCnpj_tooFewDigits_returnsFalse', () => {
      expect(isValidCnpj('1122233300018')).toBe(false);
    });

    test('test_isValidCnpj_tooManyDigits_returnsFalse', () => {
      expect(isValidCnpj('112223330001811')).toBe(false);
    });

    test('test_isValidCnpj_nonNumericCharactersBeyondMask_returnsFalse', () => {
      expect(isValidCnpj('1122233300018A')).toBe(false);
    });

    test('test_isValidCnpj_emptyString_returnsFalse', () => {
      expect(isValidCnpj('')).toBe(false);
    });
  });

  describe('stripCnpjMask', () => {
    test('test_stripCnpjMask_removesPunctuation', () => {
      expect(stripCnpjMask('11.222.333/0001-81')).toBe('11222333000181');
    });

    test('test_stripCnpjMask_unmaskedInputUnchanged', () => {
      expect(stripCnpjMask('11222333000181')).toBe('11222333000181');
    });
  });
});
