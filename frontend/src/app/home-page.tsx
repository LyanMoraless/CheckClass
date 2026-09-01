import { PERMISSION_LABELS, PERMISSIONS } from '../types/permission';
import { useAuth } from '../features/auth/auth-context';

export function HomePage() {
  const { permissions } = useAuth();

  return (
    <section>
      <h1>Bem-vindo</h1>
      <p>Use a navegação à esquerda para gerenciar a instituição.</p>
      <h2>Suas permissões</h2>
      <ul>
        {PERMISSIONS.map((permission) => (
          <li key={permission}>
            {PERMISSION_LABELS[permission]}: {permissions.has(permission) ? 'concedida' : 'não concedida'}
          </li>
        ))}
      </ul>
    </section>
  );
}
