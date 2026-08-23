import { ApiError } from '../../../lib/api-client';
import { describeCheckInError } from '../checkin-api';

test('describeCheckInError_withNoActiveSession422_returnsNoActiveSessionKind', () => {
  const error = new ApiError(422, 'No class session is currently in progress for any of your enrolled classes at this time.');

  expect(describeCheckInError(error).kind).toBe('no-active-session');
});

test('describeCheckInError_withAmbiguousSession422_returnsAmbiguousSessionKind', () => {
  const error = new ApiError(
    422,
    'More than one of your enrolled class sessions is in progress right now; automatic check-in cannot disambiguate ' +
      'between them yet (unconfirmed business behavior — see pending-decisions.md).',
  );

  expect(describeCheckInError(error).kind).toBe('ambiguous-session');
});

test('describeCheckInError_withUnrelated422_returnsOtherKindAndOriginalMessage', () => {
  const error = new ApiError(422, 'idempotency_key conflict could not be resolved for this tenant');

  const described = describeCheckInError(error);

  expect(described.kind).toBe('other');
  expect(described.message).toBe('idempotency_key conflict could not be resolved for this tenant');
});

test('describeCheckInError_withNonApiError_returnsGenericMessage', () => {
  const described = describeCheckInError(new Error('boom'));

  expect(described.kind).toBe('other');
  expect(described.message).toBe('boom');
});
