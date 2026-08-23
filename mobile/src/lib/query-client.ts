import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus, Platform } from 'react-native';

// Mobile App technology decision (architecture-overview.md): TanStack Query wired to
// React Native specifics — NetInfo drives onlineManager (so queries/mutations pause while
// offline and resume automatically once connectivity returns), AppState drives focusManager
// (so returning to the foreground refetches stale data, RN's equivalent of a browser tab
// regaining focus).
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    // isInternetReachable can be null right after a transition while NetInfo is still
    // probing — treat "unknown" as reachable rather than incorrectly pausing everything.
    setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
  });
});

function onAppStateChange(status: AppStateStatus): void {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

AppState.addEventListener('change', onAppStateChange);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A student's own attendance/schedule is a good candidate for a short staleness
      // window rather than refetch-on-every-mount — cheap reads, but no need to hammer the
      // backend every time a screen regains focus.
      staleTime: 30_000,
      retry: 2,
    },
    mutations: {
      // The check-in mutation manages its own retry/persistence story (pending-checkin
      // storage) — a built-in retry count here would fight with that, not help it.
      retry: 0,
    },
  },
});
