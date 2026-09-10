// RULE-DEV-06 emendada — the four exhaustive checkout triggers. Matches
// device_binding_checkout_reason_check exactly (AddDeviceBinding migration).
export enum CheckoutReason {
  LOGOUT = 'logout',
  SESSION_END = 'session_end',
  INACTIVITY_TIMEOUT = 'inactivity_timeout',
  TOKEN_EXPIRED = 'token_expired',
}
