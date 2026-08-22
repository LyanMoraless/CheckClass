import { PERMISSION_LABELS, PERMISSIONS } from '../types/permission';
import { useAuth } from '../features/auth/auth-context';

export function HomePage() {
  const { permissions } = useAuth();

  return (
    <section>
      <h1>Welcome</h1>
      <p>Use the navigation on the left to manage the institution.</p>
      <h2>Your permissions</h2>
      <ul>
        {PERMISSIONS.map((permission) => (
          <li key={permission}>
            {PERMISSION_LABELS[permission]}: {permissions.has(permission) ? 'granted' : 'not granted'}
          </li>
        ))}
      </ul>
    </section>
  );
}
