// RULE-INST-02 (2026-08-31 second-round update, item #2 / 2026-09-01
// third-round update, item #1): ViaCEP is the confirmed CEP provider, and is
// called directly from the frontend — a deliberate, approved architecture
// exception, not routed through the typed backend `api` client. Failure or
// "not found" must never block the form: callers fall back to empty,
// manually-editable address fields.
const VIA_CEP_BASE_URL = 'https://viacep.com.br/ws';

export interface ViaCepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export type ViaCepLookupResult =
  | { status: 'found'; address: ViaCepAddress }
  | { status: 'not-found' }
  | { status: 'unavailable' };

interface ViaCepResponse {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

export async function lookupAddressByZipCode(zipCode: string, signal?: AbortSignal): Promise<ViaCepLookupResult> {
  try {
    const response = await fetch(`${VIA_CEP_BASE_URL}/${zipCode}/json/`, { signal });
    if (!response.ok) {
      return { status: 'unavailable' };
    }
    const data = (await response.json()) as ViaCepResponse;
    if (data.erro) {
      return { status: 'not-found' };
    }
    return {
      status: 'found',
      address: {
        street: data.logradouro ?? '',
        neighborhood: data.bairro ?? '',
        city: data.localidade ?? '',
        state: data.uf ?? '',
      },
    };
  } catch {
    // Network failure, timeout, or an aborted (superseded) request.
    return { status: 'unavailable' };
  }
}
