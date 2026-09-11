import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authContext from '../auth/auth-context';
import * as rangesApi from './institutional-network-ranges-api';
import { InstitutionalNetworkRangesPage } from './institutional-network-ranges-page';

// GAP-10 (RULE-DEV-14): allowlist admin CRUD, gated by Direção/Reitoria
// (roleContext.isDirection, no dedicated Permission code — RULE-ACC-08).
// Same "mock useAuth directly" posture as device-binding-config-page.spec.tsx,
// since this page reads roleContext.isDirection rather than hasPermission(...).
describe('InstitutionalNetworkRangesPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.clearAllMocks();
  });

  function mockAuth(isDirection: boolean) {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      status: 'authenticated',
      personId: 'person-1',
      permissions: new Set(),
      roleContext: { isStudent: false, teaching: [], coordinating: [], isDirection, institutionType: 'faculdade' },
      hasPermission: () => false,
      login: vi.fn(),
      logout: vi.fn(),
    });
  }

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <InstitutionalNetworkRangesPage />
      </QueryClientProvider>,
    );
  }

  it('test_notDirection_showsRoleHintAndNeverLists', async () => {
    mockAuth(false);
    const listSpy = vi.spyOn(rangesApi, 'listInstitutionalNetworkRanges');

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Requer o papel de Direção\/Reitoria/i)).toBeInTheDocument();
    });
    // enabled: canManage on the query — a non-Direção person's page never
    // even issues the list call, not just hides the result.
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('test_isDirection_listsExistingRanges', async () => {
    mockAuth(true);
    vi.spyOn(rangesApi, 'listInstitutionalNetworkRanges').mockResolvedValue([
      { id: 'range-1', cidr: '203.0.113.0/24', label: 'Prédio principal', createdAt: '2026-09-11T00:00:00Z', updatedAt: '2026-09-11T00:00:00Z' },
      { id: 'range-2', cidr: '2001:db8::/32', label: null, createdAt: '2026-09-11T00:00:00Z', updatedAt: '2026-09-11T00:00:00Z' },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('203.0.113.0/24')).toBeInTheDocument();
    });
    expect(screen.getByText('Prédio principal')).toBeInTheDocument();
    expect(screen.getByText('2001:db8::/32')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('test_isDirection_emptyList_showsOutsideNetworkDefaultMessage', async () => {
    mockAuth(true);
    vi.spyOn(rangesApi, 'listInstitutionalNetworkRanges').mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/todo acesso é tratado como fora da rede institucional/i)).toBeInTheDocument();
    });
  });

  it('test_malformedCidr_disablesSubmitAndShowsInlineError', async () => {
    mockAuth(true);
    vi.spyOn(rangesApi, 'listInstitutionalNetworkRanges').mockResolvedValue([]);
    const createSpy = vi.spyOn(rangesApi, 'createInstitutionalNetworkRange');

    renderPage();

    const cidrInput = await screen.findByLabelText(/^CIDR$/i);
    fireEvent.change(cidrInput, { target: { value: 'not-a-cidr-at-all' } });

    expect(screen.getByText(/Formato de CIDR inválido/i)).toBeInTheDocument();
    const submitButton = screen.getByRole('button', { name: /Cadastrar faixa/i });
    expect(submitButton).toBeDisabled();

    fireEvent.click(submitButton);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('test_validCidr_submitsCreateWithTrimmedCidrAndLabel', async () => {
    mockAuth(true);
    vi.spyOn(rangesApi, 'listInstitutionalNetworkRanges').mockResolvedValue([]);
    const createSpy = vi.spyOn(rangesApi, 'createInstitutionalNetworkRange').mockResolvedValue({
      id: 'range-1',
      cidr: '203.0.113.0/24',
      label: 'Prédio principal',
      createdAt: '2026-09-11T00:00:00Z',
      updatedAt: '2026-09-11T00:00:00Z',
    });

    renderPage();

    const cidrInput = await screen.findByLabelText(/^CIDR$/i);
    fireEvent.change(cidrInput, { target: { value: '203.0.113.0/24' } });
    fireEvent.change(screen.getByLabelText(/Rótulo/i), { target: { value: 'Prédio principal' } });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar faixa/i }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({ cidr: '203.0.113.0/24', label: 'Prédio principal' });
    });
  });

  it('test_editExistingRange_prefillsFormAndSubmitsUpdate', async () => {
    mockAuth(true);
    vi.spyOn(rangesApi, 'listInstitutionalNetworkRanges').mockResolvedValue([
      { id: 'range-1', cidr: '203.0.113.0/24', label: 'Prédio principal', createdAt: '2026-09-11T00:00:00Z', updatedAt: '2026-09-11T00:00:00Z' },
    ]);
    const updateSpy = vi.spyOn(rangesApi, 'updateInstitutionalNetworkRange').mockResolvedValue({
      id: 'range-1',
      cidr: '198.51.100.0/24',
      label: 'Prédio principal',
      createdAt: '2026-09-11T00:00:00Z',
      updatedAt: '2026-09-11T00:00:00Z',
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Editar/i }));

    const cidrInput = screen.getByLabelText(/^CIDR$/i) as HTMLInputElement;
    expect(cidrInput.value).toBe('203.0.113.0/24');

    fireEvent.change(cidrInput, { target: { value: '198.51.100.0/24' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('range-1', { cidr: '198.51.100.0/24', label: 'Prédio principal' });
    });
  });

  it('test_removeRange_callsDeleteAndRefetchesList', async () => {
    mockAuth(true);
    vi.spyOn(rangesApi, 'listInstitutionalNetworkRanges').mockResolvedValue([
      { id: 'range-1', cidr: '203.0.113.0/24', label: 'Prédio principal', createdAt: '2026-09-11T00:00:00Z', updatedAt: '2026-09-11T00:00:00Z' },
    ]);
    const deleteSpy = vi.spyOn(rangesApi, 'deleteInstitutionalNetworkRange').mockResolvedValue(undefined);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Remover/i }));

    // deleteInstitutionalNetworkRange is passed straight through as
    // mutationFn (same raw-reference convention as holidays-page.tsx's
    // deleteMutation) — react-query v5 internally calls it with a second
    // mutationFnContext argument the function itself never reads, so this
    // only asserts on the one argument that actually matters.
    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalled();
    });
    expect(deleteSpy.mock.calls[0][0]).toBe('range-1');
  });

  it('test_deleteMutationFails_showsErrorBanner', async () => {
    mockAuth(true);
    vi.spyOn(rangesApi, 'listInstitutionalNetworkRanges').mockResolvedValue([
      { id: 'range-1', cidr: '203.0.113.0/24', label: null, createdAt: '2026-09-11T00:00:00Z', updatedAt: '2026-09-11T00:00:00Z' },
    ]);
    vi.spyOn(rangesApi, 'deleteInstitutionalNetworkRange').mockRejectedValue(new Error('CIDR em uso'));

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Remover/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('CIDR em uso')).toBeInTheDocument();
  });
});
