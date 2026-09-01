import { CheckCircle2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ErrorBanner } from '../../components/error-banner';
import { InfoBanner } from '../../components/info-banner';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from './auth-context';
import styles from './login-page.module.css';

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populated e.g. by a redirect from /onboarding (RULE-INST-02) when the
  // instance is already configured — `state` is otherwise only used to carry
  // `from` for the post-login redirect below, so this is safe to read
  // unconditionally.
  const infoMessage = (location.state as { message?: string } | null)?.message ?? null;

  if (status === 'authenticated') {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(cpf, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.brand}>
          <CheckCircle2 size={26} />
          <span>CheckClass</span>
        </div>
        <h1>Administração</h1>
        {infoMessage && <InfoBanner message={infoMessage} />}
        {error && <ErrorBanner message={error} />}
        <label>
          CPF
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{11}"
            maxLength={11}
            value={cpf}
            onChange={(event) => setCpf(event.target.value.replace(/\D/g, ''))}
            required
            autoComplete="username"
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
