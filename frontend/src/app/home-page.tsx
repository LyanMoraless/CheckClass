import { LayoutDashboard } from 'lucide-react';
import { Badge } from '../components/badge';
import { PageHeader } from '../components/page-header';
import { PERMISSION_LABELS, PERMISSIONS } from '../types/permission';
import { useAuth } from '../features/auth/auth-context';
import styles from './home-page.module.css';

export function HomePage() {
  const { permissions } = useAuth();

  return (
    <section>
      <PageHeader
        icon={LayoutDashboard}
        area="core"
        title="Bem-vindo"
        description="Use a navegação à esquerda para gerenciar a instituição."
      />
      <h2>Suas permissões</h2>
      <ul className={styles.permissionList}>
        {PERMISSIONS.map((permission) => {
          const granted = permissions.has(permission);
          return (
            <li key={permission} className={styles.permissionRow}>
              {PERMISSION_LABELS[permission]}
              <Badge label={granted ? 'Concedida' : 'Não concedida'} tone={granted ? 'success' : 'neutral'} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
