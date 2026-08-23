import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { NetworkError } from '../../lib/api-client';
import { generateIdempotencyKey } from '../../lib/idempotency-key';
import { clearPendingCheckIn, getPendingCheckIn, savePendingCheckIn } from '../../lib/storage/pending-checkin-storage';
import { describeCheckInError, submitCheckIn, type CheckInResult } from './checkin-api';

export type CheckInUiState =
  | { phase: 'idle' }
  | { phase: 'queued' }
  | { phase: 'success'; result: CheckInResult }
  | { phase: 'error'; message: string };

// Implements the approved lightweight offline/retry design for check-in (architecture-
// overview.md, the Mobile App technology decision, item 7): NetInfo-driven connectivity
// awareness (query-client.ts's onlineManager) plus TanStack Query's own mutation pause/
// resume already cover an in-session network drop — a mutation started while offline
// simply waits (mutation.isPaused) and fires automatically once online again, no code needed
// here for that case. What TanStack Query alone does NOT cover is the app being KILLED while
// offline (its pause state is in-memory only) — that's the one thing this hook adds: the
// pending payload is written to disk before the network call starts, and re-read/resubmitted
// on next launch or foreground.
// Shared across every useCheckIn() instance (there is only ever one check-in mutation kind)
// so an in-flight/paused submission can be detected via queryClient.isMutating() even from a
// freshly mounted hook instance whose own local `mutation` object has no memory of it — see
// the guard in retryIfPending() below.
const CHECK_IN_MUTATION_KEY = ['check-in'];

export function useCheckIn() {
  const queryClient = useQueryClient();
  const [uiState, setUiState] = useState<CheckInUiState>({ phase: 'idle' });
  const hasCheckedOnMount = useRef(false);

  const mutation = useMutation({
    mutationKey: CHECK_IN_MUTATION_KEY,
    mutationFn: submitCheckIn,
    onSuccess: async (result) => {
      await clearPendingCheckIn();
      setUiState({ phase: 'success', result });
      await queryClient.invalidateQueries({ queryKey: ['my-attendance'] });
    },
    onError: async (error) => {
      if (error instanceof NetworkError) {
        // Connectivity failure the device itself didn't already know about (NetInfo said
        // online, but the request still couldn't complete) — leave the payload persisted;
        // the mount/foreground retry below and a manual re-tap will pick it up later.
        setUiState({ phase: 'queued' });
        return;
      }
      // Anything else (422 no-active-session/ambiguous-session, or an unexpected failure) is
      // NOT a connectivity problem — retrying it unattended would just repeat the same
      // outcome, so the pending payload is cleared instead of left to retry forever.
      await clearPendingCheckIn();
      setUiState({ phase: 'error', message: describeCheckInError(error).message });
    },
  });

  async function submit(): Promise<void> {
    if (mutation.isPending) {
      return;
    }
    const pending = await getPendingCheckIn();
    if (pending) {
      // Already one queued from a previous attempt — resubmit the SAME idempotency key
      // rather than minting a new one, so this stays correct even if that earlier attempt
      // actually reached the server and this app session merely lost track of the response.
      setUiState({ phase: 'queued' });
      mutation.mutate(pending.idempotencyKey);
      return;
    }
    const idempotencyKey = generateIdempotencyKey();
    await savePendingCheckIn({ idempotencyKey, queuedAt: new Date().toISOString() });
    mutation.mutate(idempotencyKey);
  }

  useEffect(() => {
    async function retryIfPending(): Promise<void> {
      const pending = await getPendingCheckIn();
      // Checked via the shared mutationKey (not mutation.isPending) so an unmount/remount
      // while a submission is paused offline doesn't fire a second attempt: the earlier
      // instance's mutation keeps running in TanStack Query's cache after unmount, and
      // isMutating() still sees it even though this is a brand-new hook instance. Backend
      // idempotency-key dedup (RULE-ATT-10) would absorb a duplicate anyway, but this avoids
      // firing one in the first place.
      if (pending && queryClient.isMutating({ mutationKey: CHECK_IN_MUTATION_KEY }) === 0) {
        setUiState({ phase: 'queued' });
        mutation.mutate(pending.idempotencyKey);
      }
    }

    if (!hasCheckedOnMount.current) {
      hasCheckedOnMount.current = true;
      void retryIfPending();
    }

    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        void retryIfPending();
      }
    });
    return () => subscription.remove();
    // Intentionally run once: `mutation` and `queryClient` are stable across renders (same
    // hook instance), and re-subscribing on every mutation-state change would refire the
    // listener setup pointlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveState: CheckInUiState = mutation.isPaused ? { phase: 'queued' } : uiState;

  return { uiState: effectiveState, submit, isSubmitting: mutation.isPending };
}
