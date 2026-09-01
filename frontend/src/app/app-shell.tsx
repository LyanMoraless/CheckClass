import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CalendarOff,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  DoorOpen,
  GraduationCap,
  Layers,
  LogOut,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
  Video,
  Watch,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import styles from './app-shell.module.css';

type NavArea = 'core' | 'registry' | 'settings' | 'security';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  title: string;
  area: NavArea;
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
// in project-knowledge/references/architecture-overview.md). Each group has
// a signature accent color (see .module.css's --color-area-* usage) so which
// part of the app you're in is answerable at a glance, not just by reading
// the section label.
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
    area: 'core',
    items: [
      { to: '/register', label: 'Registro de presença', icon: ClipboardCheck },
      { to: '/pending-reviews', label: 'Revisões pendentes', icon: ClipboardList },
      { to: '/class-groups', label: 'Cronograma de aulas', icon: CalendarClock },
    ],
  },
  {
    title: 'Cadastro de informações',
    area: 'registry',
    items: [
      { to: '/courses', label: 'Cursos', icon: BookOpen },
      { to: '/subjects', label: 'Matérias', icon: Layers },
      { to: '/class-groups', label: 'Turmas', icon: Users },
      { to: '/students', label: 'Alunos', icon: GraduationCap },
    ],
  },
  {
    title: 'Configurações',
    area: 'settings',
    items: [
      { to: '/devices', label: 'Dispositivos', icon: Cpu },
      { to: '/wristbands', label: 'Pulseiras', icon: Watch },
      { to: '/permission-groups', label: 'Grupos de permissões', icon: ShieldCheck },
      { to: '/attendance-config', label: 'Configuração de presença', icon: SlidersHorizontal },
      { to: '/users', label: 'Usuários', icon: UserCog },
      { to: '/rooms', label: 'Salas', icon: DoorOpen },
      { to: '/holidays', label: 'Feriados', icon: CalendarOff },
    ],
  },
  {
    title: 'Segurança de Intrusão',
    area: 'security',
    items: [
      { to: '/security-incidents', label: 'Incidentes de segurança', icon: AlertTriangle },
      { to: '/cameras', label: 'Câmeras', icon: Video },
    ],
  },
];

export function AppShell() {
  const { logout } = useAuth();

  return (
    <div className={styles.layout}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          <CheckCircle2 size={22} className={styles.brandIcon} />
          <span>CheckClass</span>
        </div>
        <div className={styles.navGroups}>
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className={styles.navGroup}>
              <p className={styles.navGroupTitle}>{group.title}</p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => `${styles.navLink} ${styles[group.area]} ${isActive ? styles.active : ''}`}
                    >
                      <item.icon size={16} strokeWidth={2} className={styles.navIcon} />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <button type="button" className={`secondary ${styles.logoutButton}`} onClick={logout}>
          <LogOut size={16} />
          Sair
        </button>
      </nav>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
