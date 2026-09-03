import { useEffect, useRef } from 'react';
import type { MonitorableEventType } from '../exams/exams-api';

// Browser-side half of RULE-EXAM-04/05. It only OBSERVES and REPORTS — every
// decision (does this count as a violation, does the session end) belongs to
// the server, which is why this hook's callback returns nothing it acts on
// beyond letting the caller refresh session state.
//
// Accepted limitation, already documented as a risk in the approved
// architecture: a student who calls the API directly can bypass all of this.
// It has deterrent and record-keeping value, not tamper-proof value — there
// is no desktop agent this round.
//
// PAGE_RELOAD is deliberately NOT reported from here. The server writes it
// on session recovery (RULE-EXAM-11 makes it unconditional, unlike every
// other type), so reporting it from the client too would double-count it.

interface UseExamMonitoringOptions {
  enabledEventTypes: MonitorableEventType[];
  active: boolean;
  onEventReported: () => void;
  report: (eventType: MonitorableEventType, details?: Record<string, string>) => Promise<unknown>;
}

export function useExamMonitoring({ enabledEventTypes, active, onEventReported, report }: UseExamMonitoringOptions) {
  // Held in refs so attaching listeners doesn't depend on identities that
  // change every render — re-attaching on each keystroke would drop events
  // in the gap between removal and re-registration.
  const reportRef = useRef(report);
  const notifyRef = useRef(onEventReported);
  reportRef.current = report;
  notifyRef.current = onEventReported;

  const enabled = new Set(enabledEventTypes);

  useEffect(() => {
    if (!active) {
      return;
    }

    async function send(eventType: MonitorableEventType, details?: Record<string, string>) {
      try {
        await reportRef.current(eventType, details);
        notifyRef.current();
      } catch {
        // A failed report must never break the exam the student is taking.
        // The server is the record keeper; a dropped client report is a gap
        // in evidence, not a reason to interrupt someone mid-answer.
      }
    }

    const handlers: Array<[string, EventListener, EventTarget]> = [];

    function on(target: EventTarget, event: string, handler: EventListener) {
      target.addEventListener(event, handler);
      handlers.push([event, handler, target]);
    }

    if (enabled.has('PAGE_BLUR')) {
      on(window, 'blur', () => void send('PAGE_BLUR'));
    }

    if (enabled.has('PAGE_VISIBILITY_CHANGED')) {
      on(document, 'visibilitychange', () => {
        // Only the hidden direction is an occurrence — coming back is not.
        if (document.visibilityState === 'hidden') {
          void send('PAGE_VISIBILITY_CHANGED');
        }
      });
    }

    if (enabled.has('NEW_TAB_OR_WINDOW_ATTEMPT')) {
      // One value covers both (confirmed 2026-09-03): the browser gives the
      // same signal either way, so promising to tell a tab from a window
      // would be showing the teacher a distinction that isn't real.
      on(document, 'keydown', ((event: KeyboardEvent) => {
        const modifier = event.ctrlKey || event.metaKey;
        if (modifier && ['t', 'n'].includes(event.key.toLowerCase())) {
          event.preventDefault();
          void send('NEW_TAB_OR_WINDOW_ATTEMPT', { key: event.key.toLowerCase() });
        }
      }) as EventListener);
    }

    if (enabled.has('KEYBOARD_RESTRICTION_TRIGGERED')) {
      on(document, 'keydown', ((event: KeyboardEvent) => {
        const modifier = event.ctrlKey || event.metaKey;
        // Copy/paste/cut/print/save/devtools — the shortcuts that move exam
        // content out of the page or bring outside content in.
        const restricted = modifier && ['c', 'v', 'x', 'p', 's', 'u'].includes(event.key.toLowerCase());
        const devtools = event.key === 'F12' || (modifier && event.shiftKey && ['i', 'j'].includes(event.key.toLowerCase()));
        if (restricted || devtools) {
          event.preventDefault();
          void send('KEYBOARD_RESTRICTION_TRIGGERED', { key: event.key });
        }
      }) as EventListener);

      on(document, 'contextmenu', ((event: Event) => {
        event.preventDefault();
        void send('KEYBOARD_RESTRICTION_TRIGGERED', { key: 'contextmenu' });
      }) as EventListener);
    }

    if (enabled.has('EXTERNAL_NAVIGATION_ATTEMPT')) {
      // beforeunload fires for closing, reloading and navigating away alike.
      // We cannot tell which from here, so the detail says exactly that
      // rather than guessing — the teacher reading the timeline should not
      // be handed a certainty the browser never gave us.
      on(window, 'beforeunload', ((event: BeforeUnloadEvent) => {
        void send('EXTERNAL_NAVIGATION_ATTEMPT', { note: 'unload: close, reload or navigation' });
        event.preventDefault();
        event.returnValue = '';
      }) as EventListener);
    }

    return () => {
      for (const [event, handler, target] of handlers) {
        target.removeEventListener(event, handler);
      }
    };
    // enabledEventTypes is spread into the dep list via its join so a changed
    // SET re-attaches, without a new array identity doing so on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, enabledEventTypes.join(',')]);
}
