// RULE-INST-02 (business-rules/references/institution-management-rules.md,
// second-round update, item #3): CNPJ validation on the institution
// onboarding screen must include the official Receita Federal check-digit
// algorithm, not just a display mask/format check.
//
// Accepted format: either masked ("11.222.333/0001-81") or unmasked
// ("11222333000181") — non-digit characters are stripped before validating,
// so callers don't need to normalize input first. Callers that need the
// canonical persisted form (this project stores CNPJ unmasked, matching
// tenant.cnpj's varchar(14) column) should call stripCnpjMask themselves
// after a successful isValidCnpj check.

const FIRST_CHECK_DIGIT_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_CHECK_DIGIT_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_DIGIT_COUNT = 14;

export function stripCnpjMask(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

function calculateCheckDigit(digits: number[], weights: number[]): number {
  const sum = digits.reduce((total, digit, index) => total + digit * weights[index], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(cnpj: string): boolean {
  const digits = stripCnpjMask(cnpj);
  if (digits.length !== CNPJ_DIGIT_COUNT) {
    return false;
  }

  // All-repeated-digit sequences (e.g. "00000000000000") satisfy the
  // check-digit math below by construction but were never actually issued
  // by Receita Federal — the standard defensive exclusion every reference
  // implementation of this algorithm applies on top of the raw formula.
  if (/^(\d)\1{13}$/.test(digits)) {
    return false;
  }

  const digitValues = digits.split('').map(Number);
  const base = digitValues.slice(0, 12);

  const firstCheckDigit = calculateCheckDigit(base, FIRST_CHECK_DIGIT_WEIGHTS);
  if (firstCheckDigit !== digitValues[12]) {
    return false;
  }

  const secondCheckDigit = calculateCheckDigit([...base, firstCheckDigit], SECOND_CHECK_DIGIT_WEIGHTS);
  return secondCheckDigit === digitValues[13];
}
