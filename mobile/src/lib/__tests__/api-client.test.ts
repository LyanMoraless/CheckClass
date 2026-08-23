import { ApiError, NetworkError, apiClient, errorMessage, onForceLogout } from '../api-client';
import { clearTokenPair, getAccessToken, getRefreshToken, saveTokenPair } from '../storage/secure-token-storage';

jest.mock('../storage/secure-token-storage', () => ({
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  saveTokenPair: jest.fn(),
  clearTokenPair: jest.fn(),
}));

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.fetch = jest.fn();
  onForceLogout(() => {
    // Reset the module-level listener between tests so one test's assertions never leak
    // into another's.
  });
});

test('apiClientGet_withValidAccessToken_attachesBearerHeaderAndReturnsData', async () => {
  (getAccessToken as jest.Mock).mockResolvedValue('access-token-1');
  (globalThis.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { hello: 'world' }));

  const result = await apiClient.get<{ hello: string }>('/v1/me/schedule');

  expect(result).toEqual({ hello: 'world' });
  const [, requestInit] = (globalThis.fetch as jest.Mock).mock.calls[0];
  expect(requestInit.headers.get('Authorization')).toBe('Bearer access-token-1');
});

test('apiClientGet_onNon401Error_throwsApiErrorWithNormalizedMessage', async () => {
  (getAccessToken as jest.Mock).mockResolvedValue('access-token-1');
  (globalThis.fetch as jest.Mock).mockResolvedValue(
    jsonResponse(422, { statusCode: 422, error: { message: 'No class session is currently in progress', statusCode: 422 } }),
  );

  await expect(apiClient.get('/v1/app-checkin')).rejects.toMatchObject({
    statusCode: 422,
    message: 'No class session is currently in progress',
  });
});

test('apiClientGet_onValidationErrorArray_joinsMessagesWithSemicolon', async () => {
  (getAccessToken as jest.Mock).mockResolvedValue(null);
  (globalThis.fetch as jest.Mock).mockResolvedValue(
    jsonResponse(422, { statusCode: 422, error: { message: ['cpf must be exactly 11 digits', 'password must be a string'] } }),
  );

  await expect(apiClient.get('/v1/anything')).rejects.toMatchObject({
    message: 'cpf must be exactly 11 digits; password must be a string',
  });
});

test('apiClientGet_on401_silentlyRefreshesOnceAndRetriesOriginalRequest', async () => {
  (getAccessToken as jest.Mock).mockResolvedValue('expired-token');
  (getRefreshToken as jest.Mock).mockResolvedValue('refresh-token-1');

  (globalThis.fetch as jest.Mock)
    .mockResolvedValueOnce(jsonResponse(401, { statusCode: 401, error: 'Unauthorized' }))
    .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' }))
    .mockResolvedValueOnce(jsonResponse(200, { data: 'ok' }));

  const result = await apiClient.get<{ data: string }>('/v1/me/attendance');

  expect(result).toEqual({ data: 'ok' });
  expect(saveTokenPair).toHaveBeenCalledWith({ accessToken: 'new-access-token', refreshToken: 'new-refresh-token' });
  expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  const retryCall = (globalThis.fetch as jest.Mock).mock.calls[2];
  expect(retryCall[1].headers.get('Authorization')).toBe('Bearer new-access-token');
});

test('apiClientGet_on401WithNoStoredRefreshToken_clearsSessionAndThrowsSessionExpired', async () => {
  (getAccessToken as jest.Mock).mockResolvedValue('expired-token');
  (getRefreshToken as jest.Mock).mockResolvedValue(null);
  (globalThis.fetch as jest.Mock).mockResolvedValue(jsonResponse(401, { statusCode: 401, error: 'Unauthorized' }));

  await expect(apiClient.get('/v1/me/attendance')).rejects.toMatchObject({
    statusCode: 401,
    message: 'Your session has expired — please log in again',
  });
  expect(clearTokenPair).toHaveBeenCalled();
});

test('apiClientPost_withSkipAuthRetry_neverAttemptsRefreshOn401', async () => {
  (getAccessToken as jest.Mock).mockResolvedValue(null);
  (globalThis.fetch as jest.Mock).mockResolvedValue(jsonResponse(401, { statusCode: 401, error: 'Invalid credentials' }));

  await expect(apiClient.post('/v1/auth/login/mobile', { cpf: '12345678901', password: 'wrong' }, { skipAuthRetry: true })).rejects.toMatchObject(
    { statusCode: 401, message: 'Invalid credentials' },
  );
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  expect(getRefreshToken).not.toHaveBeenCalled();
});

test('apiClientGet_whenFetchRejects_throwsNetworkErrorNotApiError', async () => {
  (getAccessToken as jest.Mock).mockResolvedValue('token');
  (globalThis.fetch as jest.Mock).mockRejectedValue(new TypeError('Network request failed'));

  await expect(apiClient.get('/v1/me/schedule')).rejects.toBeInstanceOf(NetworkError);
});

test('errorMessage_withApiError_returnsItsMessage', () => {
  expect(errorMessage(new ApiError(404, 'not found'))).toBe('not found');
});

test('errorMessage_withNetworkError_returnsItsMessage', () => {
  expect(errorMessage(new NetworkError('offline'))).toBe('offline');
});

test('errorMessage_withUnknownValue_returnsGenericFallback', () => {
  expect(errorMessage('not an error object')).toBe('Something went wrong');
});
