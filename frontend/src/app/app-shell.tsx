import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import styles from './app-shell.module.css';

interface NavItem {
  to: string;
  label: string;
}

// Every item is always shown — a person without the underlying permission
// still sees the link but gets a clear 403 message inside the page (each
// page checks hasPermission itself for its actions). Hiding entire sections
// risked hiding the reason a feature seems "missing"; a labelled 403 is more
// legible than a vanished nav entry.
const NAV_ITEMS: NavItem[] = [
  { to: '/courses', label: 'Courses' },
  { to: '/rooms', label: 'Rooms' },
  { to: '/class-groups', label: 'Class groups' },
  { to: '/devices', label: 'Devices' },
  { to: '/attendance-config', label: 'Attendance config' },
  { to: '/register', label: 'Attendance register' },
  { to: '/pending-reviews', label: 'Pending reviews' },
  { to: '/users', label: 'Users' },
  { to: '/permission-groups', label: 'Permission groups' },
  { to: '/wristbands', label: 'Wristbands' },
  { to: '/security-incidents', label: 'Security incidents' },
  { to: '/cameras', label: 'Cameras' },
];

export function AppShell() {
  const { logout } = useAuth();

  return (
    <div className={styles.layout}>
      <nav className={styles.nav}>
        <p className={styles.brand}>CheckClass</p>
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} className={({ isActive }) => (isActive ? styles.active : undefined)}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <button type="button" onClick={logout}>
          Log out
        </button>
      </nav>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
