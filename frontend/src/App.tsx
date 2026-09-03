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
import { CourseCoordinatorAssignmentsPage } from './features/course-coordinator-assignments/course-coordinator-assignments-page';
import { CoursesPage } from './features/courses/courses-page';
import { DevicesPage } from './features/devices/devices-page';
import { HolidaysPage } from './features/holidays/holidays-page';
import { InstitutionOnboardingPage } from './features/institution-onboarding/institution-onboarding-page';
import { MyPendingReviewsPage } from './features/pending-reviews/my-pending-reviews-page';
import { PendingReviewsPage } from './features/pending-reviews/pending-reviews-page';
import { PermissionGroupsPage } from './features/permission-groups/permission-groups-page';
import { ClassGroupAttendancePage } from './features/portal-class-group-attendance/class-group-attendance-page';
import { LeadershipClassGroupsPage } from './features/portal-leadership/leadership-class-groups-page';
import { StudentAttendancePage } from './features/portal-student/student-attendance-page';
import { StudentSchedulePage } from './features/portal-student/student-schedule-page';
import { TeachingClassGroupsPage } from './features/portal-teacher/teaching-class-groups-page';
import { RoomsPage } from './features/rooms/rooms-page';
import { SecurityIncidentDetailPage } from './features/security-incidents/security-incident-detail-page';
import { SecurityIncidentsPage } from './features/security-incidents/security-incidents-page';
import { StudentsPage } from './features/students/students-page';
import { SubjectsPage } from './features/subjects/subjects-page';
import { UsersPage } from './features/users/users-page';
import { WristbandsPage } from './features/wristbands/wristbands-page';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<InstitutionOnboardingPage />} />
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
        <Route path="subjects" element={<SubjectsPage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="class-groups" element={<ClassGroupsPage />} />
        <Route path="class-groups/:classGroupId" element={<ClassGroupDetailPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="attendance-config" element={<AttendanceConfigPage />} />
        <Route path="register" element={<AttendanceRegisterPage />} />
        <Route path="pending-reviews" element={<PendingReviewsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="permission-groups" element={<PermissionGroupsPage />} />
        <Route path="wristbands" element={<WristbandsPage />} />
        <Route path="holidays" element={<HolidaysPage />} />
        <Route path="security-incidents" element={<SecurityIncidentsPage />} />
        <Route path="security-incidents/:incidentId" element={<SecurityIncidentDetailPage />} />
        <Route path="cameras" element={<CamerasPage />} />
        <Route path="course-coordinator-assignments" element={<CourseCoordinatorAssignmentsPage />} />

        {/* Portal do Aluno/Professor/Coordenador/Direção (self-service) —
            same AppShell/<Outlet/> as every route above, not a separate
            experience (see "Decisão de arquitetura — Portal de
            Autoatendimento Web, estrutura"). Nav visibility is role-gated in
            app-shell.tsx; these routes themselves stay reachable by direct
            URL like the rest of the app — the backend is what actually
            enforces "is this really your data/scope" on every /v1/me/* call. */}
        <Route path="student/schedule" element={<StudentSchedulePage />} />
        <Route path="student/attendance" element={<StudentAttendancePage />} />
        <Route path="teacher/class-groups" element={<TeachingClassGroupsPage />} />
        <Route path="coordinator/class-groups" element={<LeadershipClassGroupsPage scope="coordinator" />} />
        <Route path="direction/class-groups" element={<LeadershipClassGroupsPage scope="direction" />} />
        <Route path="portal/class-groups/:classGroupId/attendance" element={<ClassGroupAttendancePage />} />
        <Route path="portal/pending-reviews" element={<MyPendingReviewsPage />} />
      </Route>
    </Routes>
  );
}
