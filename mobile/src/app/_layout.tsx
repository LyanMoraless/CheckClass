import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Loading } from '../components/loading';
import { ScreenContainer } from '../components/screen-container';
import { AuthProvider, useAuth } from '../features/auth/auth-context';
import { queryClient } from '../lib/query-client';

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}

// expo-router's Stack.Protected pattern: when `status` flips, the screen(s) that no longer
// match their guard are removed from the navigator entirely, and any route that no longer
// resolves to a visible screen falls back to whichever screen IS available (login when
// unauthenticated, the (app) tab group when authenticated) — no manual <Redirect> needed.
function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <ScreenContainer>
        <Loading />
      </ScreenContainer>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'authenticated'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'unauthenticated'}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
