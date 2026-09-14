import * as FileSystem from 'expo-file-system/legacy';
import { ApiError, NetworkError, apiClient, errorMessage, onForceLogout } from '../api-client';
import { clearTokenPair, getAccessToken, getRefreshToken, saveTokenPair } from '../storage/secure-token-storage';

jest.mock('../storage/secure-token-storage', () => ({
  getAccessToken: jest.fn(),
  getRefreshToken: jest.fn(),
  saveTokenPair: jest.fn(),
  clearTokenPair: jest.fn(),
}));

// Overrides jest-expo's own default auto-mock (setup.js) for this file only — that default
// doesn't resolve `downloadAsync`/`readAsStringAsync` with anything shaped like a real
// FileSystemDownloadResult, which downloadToFile()'s tests below need to control explicitly.
jest.mock('expo-file-system/legacy', () => ({
  downloadAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
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

test('apiClientPostMultipart_withValidAccessToken_sendsFormDataAndReturnsData', async () => {
  (getAccessToken as jest.Mock).mockResolvedValue('access-token-1');
  (globalThis.fetch as jest.Mock).mockResolvedValue(jsonResponse(200, { submission: { id: 'sub-1' } }));

  const formData = new FormData();
  formData.append('description', 'felt sick');

  const result = await apiClient.postMultipart<{ submission: { id: string } }>('/v1/absence-justifications', formData);

  expect(result).toEqual({ submission: { id: 'sub-1' } });
  const [url, requestInit] = (globalThis.fetch as jest.Mock).mock.calls[0];
  expect(url).toContain('/v1/absence-justifications');
  expect(requestInit.method).toBe('POST');
  expect(requestInit.body).toBe(formData);
  expect(requestInit.headers.get('Authorization')).toBe('Bearer access-token-1');
  // Never set explicitly — React Native's fetch derives the multipart boundary itself from the
  // FormData body, the same reason rawFetchMultipart never sets Content-Type.
  expect(requestInit.headers.get('Content-Type')).toBeNull();
});

test('apiClientPostMultipart_on401_silentlyRefreshesOnceAndRetriesWithNewToken', async () => {
  (getAccessToken as jest.Mock).mockResolvedValue('expired-token');
  (getRefreshToken as jest.Mock).mockResolvedValue('refresh-token-1');
  (globalThis.fetch as jest.Mock)
    .mockResolvedValueOnce(jsonResponse(401, { statusCode: 401, error: 'Unauthorized' }))
    .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' }))
    .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

  const result = await apiClient.postMultipart<{ ok: boolean }>('/v1/absence-justifications', new FormData());

  expect(result).toEqual({ ok: true });
  const retryCall = (globalThis.fetch as jest.Mock).mock.calls[2];
  expect(retryCall[1].headers.get('Authorization')).toBe('Bearer new-access-token');
});

test('apiClientDownloadToFile_onSuccess_returnsLocalUriFilenameAndMimeType', async () => {
  (getAccessToken as jest.Mock).mockResolvedValue('access-token-1');
  (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
    uri: 'file:///cache/attachment-1',
    status: 200,
    mimeType: 'application/pdf',
    headers: { 'Content-Disposition': 'attachment; filename="atestado.pdf"' },
  });

  const result = await apiClient.downloadToFile('/v1/absence-justifications/sub-1/attachment', 'file:///cache/attachment-1');

  expect(result).toEqual({ localUri: 'file:///cache/attachment-1', filename: 'atestado.pdf', mimeType: 'application/pdf' });
  const [url, destinationUri, options] = (FileSystem.downloadAsync as jest.Mock).mock.calls[0];
  expect(url).toContain('/v1/absence-justifications/sub-1/attachment');
  expect(destinationUri).toBe('file:///cache/attachment-1');
  expect(options.headers.Authorization).toBe('Bearer access-token-1');
});

test('apiClientDownloadToFile_onNon2xxStatus_deletesTheFileAndThrowsApiErrorWithParsedMessage', async () => {
  (getAccessToken as jest.Mock).mockResolvedValue('access-token-1');
  (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({
    uri: 'file:///cache/attachment-1',
    status: 403,
    mimeType: 'application/json',
    headers: {},
  });
  (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(
    JSON.stringify({ statusCode: 403, error: 'You are not authorized to open this attachment (RULE-JUST-08/24)' }),
  );

  await expect(apiClient.downloadToFile('/v1/absence-justifications/sub-1/attachment', 'file:///cache/attachment-1')).rejects.toMatchObject({
    statusCode: 403,
    message: 'You are not authorized to open this attachment (RULE-JUST-08/24)',
  });
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/attachment-1', { idempotent: true });
});

test('apiClientDownloadToFile_on401_silentlyRefreshesOnceAndRetriesWithNewToken', async () => {
  (getAccessToken as jest.Mock).mockResolvedValue('expired-token');
  (getRefreshToken as jest.Mock).mockResolvedValue('refresh-token-1');
  (globalThis.fetch as jest.Mock).mockResolvedValue(
    jsonResponse(200, { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' }),
  );
  (FileSystem.downloadAsync as jest.Mock)
    .mockResolvedValueOnce({ uri: 'file:///cache/attachment-1', status: 401, mimeType: null, headers: {} })
    .mockResolvedValueOnce({ uri: 'file:///cache/attachment-1', status: 200, mimeType: 'application/pdf', headers: {} });

  const result = await apiClient.downloadToFile('/v1/absence-justifications/sub-1/attachment', 'file:///cache/attachment-1');

  expect(result.mimeType).toBe('application/pdf');
  const retryOptions = (FileSystem.downloadAsync as jest.Mock).mock.calls[1][2];
  expect(retryOptions.headers.Authorization).toBe('Bearer new-access-token');
});
