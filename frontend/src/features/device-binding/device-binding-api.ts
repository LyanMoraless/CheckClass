import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { api } from '../../lib/api-client';

// Mirrors backend/src/modules/device-binding/checkout-reason.enum.ts
// (RULE-DEV-06 emended — the four exhaustive checkout triggers) — kept in
// sync manually, same posture as types/permission.ts.
export type CheckoutReason = 'logout' | 'session_end' | 'inactivity_timeout' | 'token_expired';

export interface DeviceBinding {
  id: string;
  personId: string;
  deviceIdentityId: string;
  status: 'active' | 'checked_out';
  startedAt: string;
  checkedOutAt: string | null;
  checkoutReason: CheckoutReason | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginOptionsResponse {
  options: PublicKeyCredentialRequestOptionsJSON;
  challengeToken: string;
}

export interface CompletedLogin {
  binding: DeviceBinding;
  inactivityTimeoutMinutes: number;
}

export interface DeviceBindingConfig {
  inactivityTimeoutMinutes: number;
  // Distinguishes "the platform's hardcoded 30-minute fallback" from "what
  // this institution actually chose" (device-binding-config.service.ts) —
  // device-binding-config-page.tsx uses this to word the current value
  // honestly instead of implying it was a deliberate institutional choice.
  isDefault: boolean;
}

// No allowCredentials on purpose (discoverable credential flow) — the
// browser surfaces whichever credential(s) it holds for this RP itself, the
// server never needs to know which deviceIdentityId this browser belongs to
// beforehand (RULE-DEV-01 nota C4).
export async function generateLoginOptions(): Promise<LoginOptionsResponse> {
  return api.post('/v1/device-bindings/login-options');
}

// deviceIdentityId is never sent here — the server resolves it from the
// verified WebAuthn signature only (RULE-DEV-01 nota C4).
export async function completeLogin(challengeToken: string, response: AuthenticationResponseJSON): Promise<CompletedLogin> {
  return api.post('/v1/device-bindings/login', { challengeToken, response });
}

// Same endpoint for all four RULE-DEV-06 triggers — only reason varies.
// bindingId is never sent — always "my own active binding", resolved
// server-side from the JWT. Idempotent: a second call is a silent no-op.
export async function checkoutMyBinding(reason: CheckoutReason): Promise<{ checkedOut: boolean }> {
  return api.post('/v1/device-bindings/checkout', { reason });
}

export async function getMyActiveBinding(): Promise<DeviceBinding | null> {
  return api.get('/v1/device-bindings/me/active');
}

// RULE-DEV-13/RULE-ACC-08 — gated server-side by VIEW_DEVICE_BINDINGS.
export async function listDeviceBindings(): Promise<DeviceBinding[]> {
  return api.get('/v1/device-bindings');
}

// Open to any authenticated person (no permission/role gate on this read —
// device-binding.controller.ts's getConfig() has none) — only the write
// side below is Direção/Reitoria-restricted.
export async function getDeviceBindingConfig(): Promise<DeviceBindingConfig> {
  return api.get('/v1/device-bindings/config');
}

export async function upsertDeviceBindingConfig(inactivityTimeoutMinutes: number): Promise<{ inactivityTimeoutMinutes: number }> {
  return api.post('/v1/device-bindings/config', { inactivityTimeoutMinutes });
}
