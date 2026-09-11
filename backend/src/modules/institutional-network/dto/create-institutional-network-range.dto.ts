import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// RULE-DEV-14/GAP-10: shape-only validation here (non-empty, a generous max
// length). Actual CIDR correctness is layered — checked again by ipaddr.js
// in InstitutionalNetworkRangeService (fast, clean 400 for a garbage
// string) and finally enforced by Postgres' native `cidr` column type at
// write time (rejects a network address with host bits set — the one case
// ipaddr.js's own isValidCIDR check doesn't catch). See that service's
// header comment for the full chain.
export class CreateInstitutionalNetworkRangeDto {
  @IsString()
  @MinLength(1)
  // Longest possible IPv6 CIDR notation, e.g.
  // "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff/128" (43 chars).
  @MaxLength(43)
  cidr: string;

  // Institution-facing only (e.g. "Prédio principal", "Wi-Fi convidados") —
  // never read by the match primitive, purely so the institution can tell
  // its own ranges apart when administering the list.
  @IsString()
  @IsOptional()
  @MaxLength(255)
  label?: string;
}
