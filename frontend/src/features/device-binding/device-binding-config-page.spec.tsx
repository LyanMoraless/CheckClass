import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authContext from '../auth/auth-context';
import * as bindingApi from './device-binding-api';
import { DeviceBindingConfigPage } from './device-binding-config-page';

// Gatilho 3's inactivity threshold (RULE-DEV-06) — read is open to anyone,
// write is Direção/Reitoria only (roleContext.isDirection, no dedicated
// Permission code). Unlike attendance-config-page.spec.ts, useAuth is
// mocked directly here rather than relying on a real AuthProvider, since
// this page reads roleContext.isDirection rather than hasPermission(...).
describe('DeviceBindingConfigPage', () => {
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
        <DeviceBindingConfigPage />
      </QueryClientProvider>,
    );
  }

  it('test_deviceBindingConfigPage_isDefaultTrue_showsFallbackNotice', async () => {
    mockAuth(false);
    vi.spyOn(bindingApi, 'getDeviceBindingConfig').mockResolvedValue({ inactivityTimeoutMinutes: 30, isDefault: true });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/valor abaixo é o padrão da plataforma/i)).toBeInTheDocument();
    });
  });

  it('test_deviceBindingConfigPage_notDirection_formDisabledWithRoleHint', async () => {
    mockAuth(false);
    vi.spyOn(bindingApi, 'getDeviceBindingConfig').mockResolvedValue({ inactivityTimeoutMinutes: 45, isDefault: false });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Requer o papel de Direção\/Reitoria/i)).toBeInTheDocument();
    });
    const input = screen.getByLabelText(/Minutos de inatividade/i) as HTMLInputElement;
    expect(input.closest('fieldset')).toBeDisabled();
  });

  it('test_deviceBindingConfigPage_isDirection_submitsUpdatedMinutes', async () => {
    mockAuth(true);
    vi.spyOn(bindingApi, 'getDeviceBindingConfig').mockResolvedValue({ inactivityTimeoutMinutes: 30, isDefault: false });
    const upsertMock = vi.spyOn(bindingApi, 'upsertDeviceBindingConfig').mockResolvedValue({ inactivityTimeoutMinutes: 45 });

    renderPage();

    const input = await screen.findByDisplayValue('30');
    fireEvent.change(input, { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar configuração/i }));

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledWith(45);
    });
  });
});
