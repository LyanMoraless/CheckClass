import { Route, Routes } from 'react-router-dom';
import { AppShell } from './app/app-shell';
import { HomePage } from './app/home-page';
import { ProtectedRoute } from './app/protected-route';
import { AttendanceConfigPage } from './features/attendance-config/attendance-config-page';
import { AttendanceRegisterPage } from './features/attendance-register/attendance-register-page';
import { LoginPage } from './features/auth/login-page';
import { CamerasPage } from './features/cameras/cameras-page';
import { ClassGroupDetailPage } from './features/class-groups/class-group-detail-page';
import { ClassGroupsPage } from './features/class-groups/class-groups-page';
import { CoursesPage } from './features/courses/courses-page';
import { DevicesPage } from './features/devices/devices-page';
import { PendingReviewsPage } from './features/pending-reviews/pending-reviews-page';
import { PermissionGroupsPage } from './features/permission-groups/permission-groups-page';
import { RoomsPage } from './features/rooms/rooms-page';
import { SecurityIncidentDetailPage } from './features/security-incidents/security-incident-detail-page';
import { SecurityIncidentsPage } from './features/security-incidents/security-incidents-page';
import { UsersPage } from './features/users/users-page';
import { WristbandsPage } from './features/wristbands/wristbands-page';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="class-groups" element={<ClassGroupsPage />} />
        <Route path="class-groups/:classGroupId" element={<ClassGroupDetailPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="attendance-config" element={<AttendanceConfigPage />} />
        <Route path="register" element={<AttendanceRegisterPage />} />
        <Route path="pending-reviews" element={<PendingReviewsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="permission-groups" element={<PermissionGroupsPage />} />
        <Route path="wristbands" element={<WristbandsPage />} />
        <Route path="security-incidents" element={<SecurityIncidentsPage />} />
        <Route path="security-incidents/:incidentId" element={<SecurityIncidentDetailPage />} />
        <Route path="cameras" element={<CamerasPage />} />
      </Route>
    </Routes>
  );
}
