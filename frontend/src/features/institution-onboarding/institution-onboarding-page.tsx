import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { ApiError, errorMessage } from '../../lib/api-client';
import {
  createInstitutionOnboarding,
  getOnboardingStatus,
  type CreateInstitutionOnboardingInput,
  type InstitutionType,
} from './institution-onboarding-api';
import { lookupAddressByZipCode } from './viacep-api';
import styles from './institution-onboarding-page.module.css';

// RULE-INST-02 (2026-09-01 third-round update, item #3): accessing this
// screen after the instance is already configured redirects to /login with
// an explanatory message instead of a generic error — used both when the
// status check reports `configured: true` on mount and when the create
// request itself comes back 409 (rare race between two people loading the
// screen before either has submitted).
const ALREADY_CONFIGURED_MESSAGE = 'A instituição já foi configurada nesta instalação. Faça login para continuar.';
const AUTO_REDIRECT_DELAY_MS = 5000;

type CepLookupStatus = 'idle' | 'loading' | 'found' | 'unavailable';

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function InstitutionOnboardingPage() {
  const navigate = useNavigate();
  const statusQuery = useQuery({ queryKey: ['institution-onboarding-status'], queryFn: getOnboardingStatus });

  const [institutionName, setInstitutionName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [institutionType, setInstitutionType] = useState<InstitutionType>('faculdade');
  const [addressZipCode, setAddressZipCode] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [rootFullName, setRootFullName] = useState('');
  const [rootCpf, setRootCpf] = useState('');
  const [rootPassword, setRootPassword] = useState('');
  const [lockConflict, setLockConflict] = useState(false);

  // RULE-INST-02 (2026-09-01 third-round update, items #1-#2): ViaCEP lookup
  // is a UX affordance only. A failed/not-found lookup never blocks
  // submission — address fields just stay empty and manually editable.
  // Routed through TanStack Query (like every other fetch in this app) so
  // the request/cancellation/loading lifecycle isn't hand-rolled — the
  // frontend-direct call to ViaCEP itself is the approved architecture
  // exception, not how it's wired into React.
  const cepLookup = useQuery({
    queryKey: ['viacep-lookup', addressZipCode],
    queryFn: ({ signal }) => lookupAddressByZipCode(addressZipCode, signal),
    enabled: addressZipCode.length === 8,
    staleTime: Infinity,
  });

  // Seeds the editable address fields from a successful lookup; the fields
  // stay plain controlled state afterward so the user can freely correct
  // them without fighting the query result.
  useEffect(() => {
    if (cepLookup.data?.status === 'found') {
      setAddressStreet(cepLookup.data.address.street);
      setAddressNeighborhood(cepLookup.data.address.neighborhood);
      setAddressCity(cepLookup.data.address.city);
      setAddressState(cepLookup.data.address.state);
    }
  }, [cepLookup.data]);

  const cepStatus: CepLookupStatus =
    addressZipCode.length !== 8 ? 'idle' : cepLookup.isLoading ? 'loading' : cepLookup.data?.status === 'found' ? 'found' : 'unavailable';

  const mutation = useMutation({
    mutationFn: (input: CreateInstitutionOnboardingInput) => createInstitutionOnboarding(input),
    onError: (error) => {
      if (error instanceof ApiError && error.statusCode === 409) {
        setLockConflict(true);
      }
    },
  });

  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!mutation.isSuccess) {
      return;
    }
    redirectTimeoutRef.current = setTimeout(() => navigate('/login', { replace: true }), AUTO_REDIRECT_DELAY_MS);
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [mutation.isSuccess, navigate]);

  if (statusQuery.data?.configured || lockConflict) {
    return <Navigate to="/login" replace state={{ message: ALREADY_CONFIGURED_MESSAGE }} />;
  }

  if (statusQuery.isLoading) {
    return (
      <main className={styles.page}>
        <Loading label="Verificando disponibilidade do cadastro…" />
      </main>
    );
  }

  if (statusQuery.isError) {
    return (
      <main className={styles.page}>
        <ErrorBanner message={errorMessage(statusQuery.error)} />
      </main>
    );
  }

  if (mutation.isSuccess) {
    return (
      <main className={styles.page}>
        <div className={styles.form}>
          <h1>Instituição criada com sucesso</h1>
          <p>A instituição e a conta de administrador raiz foram criadas. Você já pode fazer login.</p>
          <button type="button" onClick={() => navigate('/login', { replace: true })}>
            Ir para o login
          </button>
        </div>
      </main>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({
      institutionName,
      cnpj,
      institutionType,
      addressZipCode,
      addressStreet,
      addressNumber,
      addressComplement: addressComplement || undefined,
      addressNeighborhood,
      addressCity,
      addressState,
      rootFullName,
      rootCpf,
      rootPassword,
    });
  }

  return (
    <main className={styles.page}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h1>Configuração inicial do CheckClass</h1>
        <p className={styles.hint}>
          Cadastre a instituição e a conta de administrador raiz. Esta tela fica disponível apenas até a primeira
          configuração desta instalação.
        </p>
        {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}

        <fieldset>
          <legend>Instituição</legend>
          <label>
            Nome da instituição
            <input
              type="text"
              value={institutionName}
              onChange={(event) => setInstitutionName(event.target.value)}
              required
              maxLength={255}
            />
          </label>
          <label>
            CNPJ
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{14}"
              maxLength={14}
              value={cnpj}
              onChange={(event) => setCnpj(onlyDigits(event.target.value))}
              required
            />
          </label>
          <label>
            Tipo de instituição
            <select value={institutionType} onChange={(event) => setInstitutionType(event.target.value as InstitutionType)} required>
              <option value="faculdade">Faculdade</option>
              <option value="escola">Escola</option>
              <option value="empresa">Empresa</option>
            </select>
          </label>
        </fieldset>

        <fieldset>
          <legend>Endereço</legend>
          <label>
            CEP
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{8}"
              maxLength={8}
              value={addressZipCode}
              onChange={(event) => setAddressZipCode(onlyDigits(event.target.value))}
              required
            />
          </label>
          {cepStatus === 'loading' && <p className={styles.hint}>Buscando endereço…</p>}
          {cepStatus === 'unavailable' && (
            <p className={styles.hint}>Não foi possível buscar o endereço automaticamente, preencha manualmente.</p>
          )}
          <label>
            Logradouro
            <input type="text" value={addressStreet} onChange={(event) => setAddressStreet(event.target.value)} required maxLength={255} />
          </label>
          <label>
            Número
            <input type="text" value={addressNumber} onChange={(event) => setAddressNumber(event.target.value)} required maxLength={20} />
          </label>
          <label>
            Complemento (opcional)
            <input type="text" value={addressComplement} onChange={(event) => setAddressComplement(event.target.value)} maxLength={255} />
          </label>
          <label>
            Bairro
            <input
              type="text"
              value={addressNeighborhood}
              onChange={(event) => setAddressNeighborhood(event.target.value)}
              required
              maxLength={255}
            />
          </label>
          <label>
            Cidade
            <input type="text" value={addressCity} onChange={(event) => setAddressCity(event.target.value)} required maxLength={255} />
          </label>
          <label>
            UF
            <input
              type="text"
              maxLength={2}
              value={addressState}
              onChange={(event) => setAddressState(event.target.value.toUpperCase())}
              required
            />
          </label>
        </fieldset>

        <fieldset>
          <legend>Conta de administrador raiz</legend>
          <label>
            Nome completo
            <input type="text" value={rootFullName} onChange={(event) => setRootFullName(event.target.value)} required maxLength={255} />
          </label>
          <label>
            CPF
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{11}"
              maxLength={11}
              value={rootCpf}
              onChange={(event) => setRootCpf(onlyDigits(event.target.value))}
              required
              autoComplete="username"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={rootPassword}
              onChange={(event) => setRootPassword(event.target.value)}
              required
              autoComplete="new-password"
            />
          </label>
        </fieldset>

        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Criando instituição…' : 'Criar instituição'}
        </button>
      </form>
    </main>
  );
}
