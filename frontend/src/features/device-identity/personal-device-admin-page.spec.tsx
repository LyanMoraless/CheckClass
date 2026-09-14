import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authContext from '../auth/auth-context';
import * as usersApi from '../users/users-api';
import * as personalDeviceApi from './personal-device-api';
import { PersonalDeviceAdminPage } from './personal-device-admin-page';

// RULE-DEV-18 admin flow: Direção/Reitoria searches a person's active BYOD
// by personId and revokes it administratively — reuses the exact same
// revokePersonalDevice() call self-service already exercises on
// my-personal-device-page.tsx. Gated on roleContext.isDirection, no
// dedicated Permission code, same "mock useAuth directly" posture as
// institutional-machines-page.spec.tsx-equivalent pages in this app.
describe('PersonalDeviceAdminPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.clearAllMocks();
    // PersonIdField's own listPersons() lookup — irrelevant to this page's
    // behavior, mocked to resolve so it never hits real fetch in jsdom.
    vi.spyOn(usersApi, 'listPersons').mockResolvedValue([]);
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
        <PersonalDeviceAdminPage />
      </QueryClientProvider>,
    );
  }

  it('test_notDirection_showsRoleHintAndNeverSearches', async () => {
    mockAuth(false);
    const findSpy = vi.spyOn(personalDeviceApi, 'findPersonalDeviceByPerson');

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Requer o papel de Direção\/Reitoria/i)).toBeInTheDocument();
    });
    expect(findSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Buscar/i })).not.toBeInTheDocument();
  });

  it('test_isDirection_searchWithActiveDevice_showsDeviceAndRevokeButton', async () => {
    mockAuth(true);
    vi.spyOn(personalDeviceApi, 'findPersonalDeviceByPerson').mockResolvedValue({
      id: 'device-1',
      personId: 'owner-1',
      label: 'Notebook do aluno',
      revokedAt: null,
      revokedByPersonId: null,
      createdAt: '2026-09-10T00:00:00Z',
      updatedAt: '2026-09-10T00:00:00Z',
    });

    renderPage();

    const personIdInput = await screen.findByLabelText(/^Pessoa$/i);
    fireEvent.change(personIdInput, { target: { value: 'owner-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));

    await waitFor(() => {
      expect(screen.getByText('Notebook do aluno')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Revogar dispositivo/i })).toBeInTheDocument();
  });

  it('test_isDirection_searchWithNoActiveDevice_showsInfoBanner', async () => {
    mockAuth(true);
    vi.spyOn(personalDeviceApi, 'findPersonalDeviceByPerson').mockResolvedValue(null);

    renderPage();

    const personIdInput = await screen.findByLabelText(/^Pessoa$/i);
    fireEvent.change(personIdInput, { target: { value: 'owner-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));

    await waitFor(() => {
      expect(screen.getByText(/não tem nenhum dispositivo pessoal/i)).toBeInTheDocument();
    });
  });

  it('test_revokeButtonClicked_callsRevokeAndRefetchesSearch', async () => {
    mockAuth(true);
    const findSpy = vi
      .spyOn(personalDeviceApi, 'findPersonalDeviceByPerson')
      .mockResolvedValueOnce({
        id: 'device-1',
        personId: 'owner-1',
        label: null,
        revokedAt: null,
        revokedByPersonId: null,
        createdAt: '2026-09-10T00:00:00Z',
        updatedAt: '2026-09-10T00:00:00Z',
      })
      .mockResolvedValueOnce(null);
    const revokeSpy = vi.spyOn(personalDeviceApi, 'revokePersonalDevice').mockResolvedValue({ id: 'device-1', status: 'revoked' });

    renderPage();

    const personIdInput = await screen.findByLabelText(/^Pessoa$/i);
    fireEvent.change(personIdInput, { target: { value: 'owner-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));

    fireEvent.click(await screen.findByRole('button', { name: /Revogar dispositivo/i }));

    await waitFor(() => {
      expect(revokeSpy).toHaveBeenCalledWith('device-1');
    });
    await waitFor(() => {
      expect(findSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('test_revokeMutationFails_showsErrorBanner', async () => {
    mockAuth(true);
    vi.spyOn(personalDeviceApi, 'findPersonalDeviceByPerson').mockResolvedValue({
      id: 'device-1',
      personId: 'owner-1',
      label: null,
      revokedAt: null,
      revokedByPersonId: null,
      createdAt: '2026-09-10T00:00:00Z',
      updatedAt: '2026-09-10T00:00:00Z',
    });
    vi.spyOn(personalDeviceApi, 'revokePersonalDevice').mockRejectedValue(new Error('sem autorização'));

    renderPage();

    const personIdInput = await screen.findByLabelText(/^Pessoa$/i);
    fireEvent.change(personIdInput, { target: { value: 'owner-1' } });
    fireEvent.click(screen.getByRole('button', { name: /Buscar/i }));

    fireEvent.click(await screen.findByRole('button', { name: /Revogar dispositivo/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('sem autorização')).toBeInTheDocument();
  });
});
