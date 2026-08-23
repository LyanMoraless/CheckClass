import { clearPendingCheckIn, getPendingCheckIn, savePendingCheckIn } from '../pending-checkin-storage';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    removeItem: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

beforeEach(async () => {
  await clearPendingCheckIn();
});

test('getPendingCheckIn_whenNothingStored_returnsNull', async () => {
  expect(await getPendingCheckIn()).toBeNull();
});

test('savePendingCheckIn_thenGetPendingCheckIn_returnsTheSameValue', async () => {
  await savePendingCheckIn({ idempotencyKey: 'abc-123', queuedAt: '2026-08-22T10:00:00.000Z' });

  expect(await getPendingCheckIn()).toEqual({ idempotencyKey: 'abc-123', queuedAt: '2026-08-22T10:00:00.000Z' });
});

test('clearPendingCheckIn_afterSaving_removesTheEntry', async () => {
  await savePendingCheckIn({ idempotencyKey: 'abc-123', queuedAt: '2026-08-22T10:00:00.000Z' });

  await clearPendingCheckIn();

  expect(await getPendingCheckIn()).toBeNull();
});
