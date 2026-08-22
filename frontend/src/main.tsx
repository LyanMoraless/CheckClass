import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './features/auth/auth-context';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    // 401s already short-circuit at the api-client layer (session drop, not
    // a transient failure) — retrying a 403/404/422 domain error also isn't
    // useful, so retries are opt-in per query rather than a global default.
    queries: { retry: false },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
