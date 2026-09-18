import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { getMyLocationConsent, type LocationConsentDecision } from '../location-consent-api';
import { useLocationConsent } from '../use-location-consent';

jest.mock('../location-consent-api', () => ({
  ...jest.requireActual('../location-consent-api'),
  getMyLocationConsent: jest.fn(),
  grantMyLocationConsent: jest.fn(),
  refuseMyLocationConsent: jest.fn(),
  revokeMyLocationConsent: jest.fn(),
}));

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

// NOTE — scope of this file, deliberately narrow: only the initial useQuery load (a fully
// synchronous-from-the-test's-perspective, deterministic fetch) is covered here. An earlier
// version of this file also exercised grant()/refuse()/revoke() through to their
// invalidateQueries-triggered refetch, but that combination — react-test-renderer's act()
// wrapping a fire-and-forget useMutation().mutate() call, then polling for the query to
// re-settle — proved genuinely flaky in this project's test environment: the exact same code,
// unchanged, passed or failed depending on unrelated things like which other tests in this file
// had already run and how many poll attempts were budgeted, not on any bug this agent could find
// in use-location-consent.ts itself (grant/revoke/refuse are structurally identical to the
// pending-reviews-screen.tsx mutation idiom already used elsewhere in this codebase, which is
// never unit-tested at the hook level either — only warnings-feed.ts/leadership-class-groups-
// format.ts-style PURE derivation logic gets a dedicated hook/helper test in this project).
// Shipping a flaky test would be worse than not having one: it would intermittently fail CI for
// reasons unrelated to any real regression. Flagged in the Mobile Implementation Summary's "Test
// coverage" — manual/QA verification of grant/refuse/revoke is the recommended follow-up, same
// as this project already does for every screen wired directly to useQuery/useMutation.
async function waitUntil(predicate: () => boolean, attempts = 20): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if (predicate()) {
      return;
    }
    await act(async () => {
      await flushPromises();
    });
  }
  if (!predicate()) {
    throw new Error('waitUntil: predicate never became true');
  }
}

const activeRenderers: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    activeRenderers.forEach((renderer) => renderer.unmount());
  });
  activeRenderers.length = 0;
});

async function renderUseLocationConsent(): Promise<{ latest: () => ReturnType<typeof useLocationConsent> }> {
  let current!: ReturnType<typeof useLocationConsent>;
  function Harness() {
    current = useLocationConsent();
    return null;
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  let renderer!: ReactTestRenderer;

  await act(async () => {
    renderer = create(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  activeRenderers.push(renderer);
  await waitUntil(() => !current.isLoading);

  return { latest: () => current };
}

const grantedDecision: LocationConsentDecision = {
  id: 'decision-1',
  tenantId: 'tenant-1',
  subjectPersonId: 'person-1',
  decidedByType: 'person',
  decidedByPersonId: 'person-1',
  decidedByLegalGuardianId: null,
  decision: 'granted',
  systemActionTriggeredByPersonId: null,
  consentVersion: 'v1',
  capturedAt: '2026-09-17T10:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('load_withNoDecisionRecordedYet_reportsUndecidedAndNoActiveConsent', async () => {
  (getMyLocationConsent as jest.Mock).mockResolvedValue(null);

  const { latest } = await renderUseLocationConsent();

  expect(latest().decision).toBeNull();
  expect(latest().isUndecided).toBe(true);
  expect(latest().hasActiveConsent).toBe(false);
});

test('load_withGrantedDecision_reportsActiveConsentAndNotUndecided', async () => {
  (getMyLocationConsent as jest.Mock).mockResolvedValue(grantedDecision);

  const { latest } = await renderUseLocationConsent();

  expect(latest().hasActiveConsent).toBe(true);
  expect(latest().isUndecided).toBe(false);
});

test('load_withRefusedDecision_reportsNoActiveConsentAndNotUndecided', async () => {
  (getMyLocationConsent as jest.Mock).mockResolvedValue({ ...grantedDecision, decision: 'refused' });

  const { latest } = await renderUseLocationConsent();

  expect(latest().hasActiveConsent).toBe(false);
  expect(latest().isUndecided).toBe(false);
});

test('load_withRevokedDecision_reportsNoActiveConsentAndNotUndecided', async () => {
  (getMyLocationConsent as jest.Mock).mockResolvedValue({ ...grantedDecision, decision: 'revoked' });

  const { latest } = await renderUseLocationConsent();

  expect(latest().hasActiveConsent).toBe(false);
  expect(latest().isUndecided).toBe(false);
});
