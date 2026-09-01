import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import styles from './app-shell.module.css';

interface NavItem {
  to: string;
  label: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// Every item is always shown — a person without the underlying permission
// still sees the link but gets a clear 403 message inside the page (each
// page checks hasPermission itself for its actions). Hiding entire sections
// risked hiding the reason a feature seems "missing"; a labelled 403 is more
// legible than a vanished nav entry.
//
// Groups mirror the confirmed information architecture from the
// institution-management pivot (see "Escopo confirmado — Pivot estrutural"
// in project-knowledge/references/architecture-overview.md).
//
// Cronograma de aulas (RULE-INST-04) was confirmed for "Sistema principal",
// but the recurring grade/session-generation UI itself lives inside the
// Turma detail page (class-group-detail-page.tsx) rather than a standalone
// route — the grade, its slots and its generated sessions only ever make
// sense scoped to one specific turma, so there is no meaningful "cronograma
// list" to land on without first picking a turma. This nav entry and the
// "Turmas" entry below therefore intentionally point to the same
// `/class-groups` route: one for the "manage turma composition" intent, one
// for the "reach a turma's cronograma" intent, both served by the same list
// -> detail flow.
const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Sistema principal',
    items: [
      { to: '/register', label: 'Registro de presença' },
      { to: '/pending-reviews', label: 'Revisões pendentes' },
      { to: '/class-groups', label: 'Cronograma de aulas' },
    ],
  },
  {
    title: 'Cadastro de informações',
    items: [
      { to: '/courses', label: 'Cursos' },
      { to: '/subjects', label: 'Matérias' },
      { to: '/class-groups', label: 'Turmas' },
      { to: '/students', label: 'Alunos' },
    ],
  },
  {
    title: 'Configurações',
    items: [
      { to: '/devices', label: 'Dispositivos' },
      { to: '/wristbands', label: 'Pulseiras' },
      { to: '/permission-groups', label: 'Grupos de permissões' },
      { to: '/attendance-config', label: 'Configuração de presença' },
      { to: '/users', label: 'Usuários' },
      { to: '/rooms', label: 'Salas' },
      { to: '/holidays', label: 'Feriados' },
    ],
  },
  {
    title: 'Segurança de Intrusão',
    items: [
      { to: '/security-incidents', label: 'Incidentes de segurança' },
      { to: '/cameras', label: 'Câmeras' },
    ],
  },
];

export function AppShell() {
  const { logout } = useAuth();

  return (
    <div className={styles.layout}>
      <nav className={styles.nav}>
        <p className={styles.brand}>CheckClass</p>
        <div className={styles.navGroups}>
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className={styles.navGroup}>
              <p className={styles.navGroupTitle}>{group.title}</p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink to={item.to} className={({ isActive }) => (isActive ? styles.active : undefined)}>
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <button type="button" onClick={logout}>
          Sair
        </button>
      </nav>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
