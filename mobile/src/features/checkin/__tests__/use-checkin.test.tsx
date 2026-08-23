import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ApiError, NetworkError } from '../../../lib/api-client';
import { generateIdempotencyKey } from '../../../lib/idempotency-key';
import { clearPendingCheckIn, getPendingCheckIn, savePendingCheckIn, type PendingCheckIn } from '../../../lib/storage/pending-checkin-storage';
import { submitCheckIn } from '../checkin-api';
import { useCheckIn } from '../use-checkin';

jest.mock('../checkin-api', () => ({
  ...jest.requireActual('../checkin-api'),
  submitCheckIn: jest.fn(),
}));

jest.mock('../../../lib/storage/pending-checkin-storage', () => ({
  getPendingCheckIn: jest.fn(),
  savePendingCheckIn: jest.fn(),
  clearPendingCheckIn: jest.fn(),
}));

jest.mock('../../../lib/idempotency-key', () => ({
  generateIdempotencyKey: jest.fn(),
}));

// Resolves once the current microtask queue has fully drained — enough to let TanStack
// Query's internal mutate() chain (and this hook's own onSuccess/onError awaits, all backed
// by mocked native promises) settle between act() calls.
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

async function renderUseCheckIn(): Promise<{ latest: () => ReturnType<typeof useCheckIn>; unmount: () => void }> {
  let current!: ReturnType<typeof useCheckIn>;
  function Harness() {
    current = useCheckIn();
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
    // Lets the mount-time auto-resubmission effect (retryIfPending) settle.
    await flushPromises();
    await flushPromises();
  });

  return { latest: () => current, unmount: () => renderer.unmount() };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('submit_onSuccessfulSubmission_clearsAnyPendingRecordAndReportsSuccess', async () => {
  (getPendingCheckIn as jest.Mock).mockResolvedValue(null);
  (generateIdempotencyKey as jest.Mock).mockReturnValue('key-1');
  (submitCheckIn as jest.Mock).mockResolvedValue({ eventId: 'evt-1', created: true });

  const { latest } = await renderUseCheckIn();

  await act(async () => {
    await latest().submit();
    await flushPromises();
    await flushPromises();
  });

  expect(savePendingCheckIn).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'key-1' }));
  expect((submitCheckIn as jest.Mock).mock.calls[0][0]).toBe('key-1');
  expect(clearPendingCheckIn).toHaveBeenCalled();
  expect(latest().uiState).toEqual({ phase: 'success', result: { eventId: 'evt-1', created: true } });
});

test('submit_onNetworkError_persistsPendingRecordAndDoesNotClearIt', async () => {
  (getPendingCheckIn as jest.Mock).mockResolvedValue(null);
  (generateIdempotencyKey as jest.Mock).mockReturnValue('key-2');
  (submitCheckIn as jest.Mock).mockRejectedValue(new NetworkError('Could not reach the CheckClass server — check your connection.'));

  const { latest } = await renderUseCheckIn();

  await act(async () => {
    await latest().submit();
    await flushPromises();
    await flushPromises();
  });

  expect(savePendingCheckIn).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'key-2' }));
  expect(clearPendingCheckIn).not.toHaveBeenCalled();
  expect(latest().uiState).toEqual({ phase: 'queued' });
});

test('submit_on422NoActiveSessionFailure_clearsPendingRecordSinceRetryingWouldNotHelp', async () => {
  (getPendingCheckIn as jest.Mock).mockResolvedValue(null);
  (generateIdempotencyKey as jest.Mock).mockReturnValue('key-3');
  (submitCheckIn as jest.Mock).mockRejectedValue(new ApiError(422, 'No class session is currently in progress for any of your enrolled classes.'));

  const { latest } = await renderUseCheckIn();

  await act(async () => {
    await latest().submit();
    await flushPromises();
    await flushPromises();
  });

  expect(clearPendingCheckIn).toHaveBeenCalled();
  expect(latest().uiState).toEqual({
    phase: 'error',
    message: "You don't have a class session in progress right now — check-in is only available during a scheduled class.",
  });
});

test('submit_on422AmbiguousSessionFailure_clearsPendingRecordSinceRetryingWouldNotHelp', async () => {
  (getPendingCheckIn as jest.Mock).mockResolvedValue(null);
  (generateIdempotencyKey as jest.Mock).mockReturnValue('key-4');
  (submitCheckIn as jest.Mock).mockRejectedValue(
    new ApiError(422, 'More than one of your enrolled class sessions is in progress right now.'),
  );

  const { latest } = await renderUseCheckIn();

  await act(async () => {
    await latest().submit();
    await flushPromises();
    await flushPromises();
  });

  expect(clearPendingCheckIn).toHaveBeenCalled();
  expect(latest().uiState.phase).toBe('error');
});

test('mount_withExistingPendingRecord_automaticallyResubmitsReusingItsStoredIdempotencyKey', async () => {
  const storedPending: PendingCheckIn = { idempotencyKey: 'stored-key', queuedAt: '2026-08-20T10:00:00.000Z' };
  (getPendingCheckIn as jest.Mock).mockResolvedValue(storedPending);
  (submitCheckIn as jest.Mock).mockResolvedValue({ eventId: 'evt-2', created: false });

  const { latest } = await renderUseCheckIn();

  expect((submitCheckIn as jest.Mock).mock.calls[0][0]).toBe('stored-key');
  expect(generateIdempotencyKey).not.toHaveBeenCalled();
  expect(savePendingCheckIn).not.toHaveBeenCalled();
  expect(latest().uiState).toEqual({ phase: 'success', result: { eventId: 'evt-2', created: false } });
});
