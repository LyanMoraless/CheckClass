import { startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON } from '@simplewebauthn/browser';
import { api } from '../../lib/api-client';

// Shared WebAuthn matrícula (RULE-DEV-01/02 — "mesma capacidade
// compartilhada, sem bifurcar código"): the same two-endpoint ceremony
// enrolls a credential for an institutional_machine OR a personal_device —
// the only thing that differs is which deviceIdentityId is passed in. This
// module owns the ceremony itself; who is authorized to call it for a given
// deviceIdentityId is enforced server-side (DeviceCredentialService.assertCanManageCredential).

interface RegistrationOptionsResponse {
  options: PublicKeyCredentialCreationOptionsJSON;
  challengeToken: string;
}

// A DELIBERATE action (the caller navigated to a screen and clicked
// "Matricular credencial" for a specific machine/device they intend to
// enroll right now) — unlike the ambient post-login binding offer
// (use-device-binding-session.ts), a failure here is a real, actionable
// error worth surfacing to whoever triggered it (ErrorBanner at the call
// site), not silently swallowed. RULE-DEV-01's reimage exception means
// calling this again for an already-enrolled device is expected and valid
// (revokes the old credential, enrolls a fresh one) — not a special case
// this function needs to branch on.
export async function enrollDeviceCredential(deviceIdentityId: string): Promise<void> {
  const { options, challengeToken } = await api.post<RegistrationOptionsResponse>(
    `/v1/device-identity/credentials/${deviceIdentityId}/registration-options`,
  );
  const response: RegistrationResponseJSON = await startRegistration({ optionsJSON: options });
  await api.post(`/v1/device-identity/credentials/${deviceIdentityId}/registration-verify`, { challengeToken, response });
}
