// Client-side CIDR shape check — fast feedback only, deliberately NOT the
// authority on correctness. The real validation is layered server-side
// (InstitutionalNetworkRangeService.assertValidCidrShape via ipaddr.js's
// isValidCIDR, then Postgres' native `cidr` column type at write time,
// which additionally rejects a network address with host bits set, e.g.
// "192.168.1.5/24" — see that service's own header comment for the full
// chain). This regex intentionally does NOT try to catch the host-bits
// case; it exists only so an obviously malformed string (missing slash,
// out-of-range octet, stray letters) never has to round-trip to the API
// for a 400. It must never accept something the backend would reject —
// if in doubt, this stays stricter than the server, never more permissive.
const IPV4_CIDR_PATTERN = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\/(3[0-2]|[12]?\d)$/;

// Standard compressed/uncompressed IPv6 address forms, "/0"-"/128" prefix.
const IPV6_CIDR_PATTERN =
  /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01]\d|[1-9]?\d)$/;

export function isPlausibleCidrShape(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') {
    return false;
  }
  // Longest possible IPv6 CIDR notation is 43 chars (mirrors
  // CreateInstitutionalNetworkRangeDto's own MaxLength(43)) — rejecting a
  // longer string here up front is just cheaper UX feedback than waiting
  // for the pattern match to fail anyway.
  if (trimmed.length > 43) {
    return false;
  }
  return IPV4_CIDR_PATTERN.test(trimmed) || IPV6_CIDR_PATTERN.test(trimmed);
}
