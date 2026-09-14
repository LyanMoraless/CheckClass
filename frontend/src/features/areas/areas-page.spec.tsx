import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authContext from '../auth/auth-context';
import * as areasApi from './areas-api';
import { AreasPage } from './areas-page';

// Frente 08: institution self-service create+list for its own área/bloco
// structure, gated on manage_institution_structure — same "mock useAuth
// directly" posture as institutional-network-ranges-page.spec.tsx, since
// this page reads hasPermission(...) rather than roleContext.isDirection
// (areas is a permission-coded feature, not a role-only one like RULE-DEV-15).
describe('AreasPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.clearAllMocks();
  });

  function mockAuth(canManage: boolean) {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      status: 'authenticated',
      personId: 'person-1',
      permissions: canManage ? new Set(['manage_institution_structure']) : new Set(),
      roleContext: { isStudent: false, teaching: [], coordinating: [], isDirection: false, institutionType: 'faculdade' },
      hasPermission: (permission: string) => canManage && permission === 'manage_institution_structure',
      login: vi.fn(),
      logout: vi.fn(),
    });
  }

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <AreasPage />
      </QueryClientProvider>,
    );
  }

  it('test_noPermission_showsPermissionHintAndNeverLists', async () => {
    mockAuth(false);
    const listSpy = vi.spyOn(areasApi, 'listAreas');

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Requer a permissão/i)).toBeInTheDocument();
    });
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('test_hasPermission_listsExistingAreasWithParentName', async () => {
    mockAuth(true);
    vi.spyOn(areasApi, 'listAreas').mockResolvedValue([
      { id: 'area-1', parentAreaId: null, name: 'Bloco A' },
      { id: 'area-2', parentAreaId: 'area-1', name: 'Andar 1' },
    ]);

    renderPage();

    // "Bloco A" appears three times (row 1's own name, row 2's resolved
    // parent name, AND the parent <select>'s option) — scope assertions to
    // each table row via its (implicit) 'row'/'cell' roles to disambiguate.
    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2 data rows
    });
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByRole('cell', { name: 'Bloco A' })).toBeInTheDocument();
    expect(within(rows[1]).getByRole('cell', { name: '—' })).toBeInTheDocument();
    expect(within(rows[2]).getByRole('cell', { name: 'Andar 1' })).toBeInTheDocument();
    expect(within(rows[2]).getByRole('cell', { name: 'Bloco A' })).toBeInTheDocument();
  });

  it('test_hasPermission_emptyList_showsEmptyMessage', async () => {
    mockAuth(true);
    vi.spyOn(areasApi, 'listAreas').mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Nenhuma área cadastrada ainda.')).toBeInTheDocument();
    });
  });

  it('test_blankName_disablesSubmit', async () => {
    mockAuth(true);
    vi.spyOn(areasApi, 'listAreas').mockResolvedValue([]);
    const createSpy = vi.spyOn(areasApi, 'createArea');

    renderPage();

    const submitButton = await screen.findByRole('button', { name: /Cadastrar área/i });
    expect(submitButton).toBeDisabled();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('test_validName_submitsCreateWithoutParent', async () => {
    mockAuth(true);
    vi.spyOn(areasApi, 'listAreas').mockResolvedValue([]);
    const createSpy = vi.spyOn(areasApi, 'createArea').mockResolvedValue({ id: 'area-1', parentAreaId: null, name: 'Bloco A' });

    renderPage();

    const nameInput = await screen.findByLabelText(/^Nome$/i);
    fireEvent.change(nameInput, { target: { value: 'Bloco A' } });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar área/i }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({ name: 'Bloco A', parentAreaId: undefined });
    });
  });

  it('test_validNameWithParent_submitsCreateWithParentAreaId', async () => {
    mockAuth(true);
    vi.spyOn(areasApi, 'listAreas').mockResolvedValue([{ id: 'area-1', parentAreaId: null, name: 'Bloco A' }]);
    const createSpy = vi.spyOn(areasApi, 'createArea').mockResolvedValue({ id: 'area-2', parentAreaId: 'area-1', name: 'Andar 1' });

    renderPage();

    const nameInput = await screen.findByLabelText(/^Nome$/i);
    fireEvent.change(nameInput, { target: { value: 'Andar 1' } });
    fireEvent.change(screen.getByLabelText(/Bloco\/área pai/i), { target: { value: 'area-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar área/i }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({ name: 'Andar 1', parentAreaId: 'area-1' });
    });
  });

  it('test_createMutationFails_showsErrorBanner', async () => {
    mockAuth(true);
    vi.spyOn(areasApi, 'listAreas').mockResolvedValue([]);
    vi.spyOn(areasApi, 'createArea').mockRejectedValue(new Error('nome já em uso'));

    renderPage();

    const nameInput = await screen.findByLabelText(/^Nome$/i);
    fireEvent.change(nameInput, { target: { value: 'Bloco A' } });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar área/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('nome já em uso')).toBeInTheDocument();
  });
});
