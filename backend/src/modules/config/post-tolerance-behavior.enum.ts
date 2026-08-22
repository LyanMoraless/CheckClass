// RULE-ATT-14: exactly these three values, the same for every institution —
// unlike the factor list (RULE-ATT-13), this set is not extensible.
export enum PostToleranceBehavior {
  BLOCK_CHECKIN = 'block_checkin',
  DENY_PRESENCE = 'deny_presence',
  REGISTER_ONLY = 'register_only',
}
