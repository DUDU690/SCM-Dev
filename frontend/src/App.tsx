import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { fetchCurrentUser } from './store/slices/authSlice';
import { Toaster } from './components/ui/Toaster';

import LoginPage from './pages/auth/LoginPage';
import AppLayout from './layouts/AppLayout';
import AdminDashboard from './pages/admin/Dashboard';
import FacultyDashboard from './pages/faculty/Dashboard';
import StudentDashboard from './pages/student/Dashboard';

// Admin pages
import StudentsPage from './pages/admin/Students';
import StudentDetailPage from './pages/admin/StudentDetail';
import FacultyPage from './pages/admin/Faculty';
import FacultyDetailPage from './pages/admin/FacultyDetail';
import ClassesPage from './pages/admin/Classes';
import SubjectsPage from './pages/admin/Subjects';
import AcademicYearsPage from './pages/admin/AcademicYears';
import TimetablePage from './pages/admin/Timetable';
import HolidaysPage from './pages/admin/Holidays';
import AttendancePage from './pages/admin/Attendance';
import ExaminationsPage from './pages/admin/Examinations';
import MarksPage from './pages/admin/Marks';
import FeesPage from './pages/admin/Fees';
import AdmissionsPage from './pages/admin/Admissions';
import HostelPage from './pages/admin/Hostel';
import EventsPage from './pages/admin/Events';
import AchievementsPage from './pages/admin/Achievements';
import GalleryPage from './pages/admin/Gallery';
import OnlineClassesPage from './pages/admin/OnlineClasses';
import AssignmentsPage from './pages/admin/Assignments';
import NotificationsPage from './pages/shared/Notifications';
import ReportsPage from './pages/admin/Reports';
import SettingsPage from './pages/admin/Settings';
import AuditLogsPage from './pages/admin/AuditLogs';
import UsersPage from './pages/admin/Users';

// Faculty pages
import FacultyAttendancePage from './pages/faculty/Attendance';
import FacultyMarksPage from './pages/faculty/Marks';
import FacultyTimetablePage from './pages/faculty/Timetable';
import FacultyStudentsPage from './pages/faculty/Students';

// Student pages
import StudentTimetablePage from './pages/student/Timetable';
import StudentAttendancePage from './pages/student/Attendance';
import StudentResultsPage from './pages/student/Results';
import StudentFeesPage from './pages/student/Fees';
import StudentAssignmentsPage from './pages/student/Assignments';
import StudentProfilePage from './pages/student/Profile';

import ProfilePage from './pages/shared/Profile';
import NotFoundPage from './pages/NotFound';
import LoadingSpinner from './components/ui/LoadingSpinner';
import ProtectedRoute from './components/auth/ProtectedRoute';

export default function App() {
  const dispatch = useAppDispatch();
  const { initialized, isAuthenticated, user } = useAppSelector((s) => s.auth);

  useEffect(() => {
    dispatch(fetchCurrentUser());
  }, [dispatch]);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            {/* Redirect /dashboard based on role */}
            <Route
              path="/dashboard"
              element={
                user?.role === 'ADMIN' ? <AdminDashboard /> :
                user?.role === 'FACULTY' ? <FacultyDashboard /> :
                <StudentDashboard />
              }
            />

            {/* Admin routes */}
            <Route element={<ProtectedRoute roles={['ADMIN']} />}>
              <Route path="/users" element={<UsersPage />} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/students/:id" element={<StudentDetailPage />} />
              <Route path="/faculty" element={<FacultyPage />} />
              <Route path="/faculty/:id" element={<FacultyDetailPage />} />
              <Route path="/classes" element={<ClassesPage />} />
              <Route path="/subjects" element={<SubjectsPage />} />
              <Route path="/academic-years" element={<AcademicYearsPage />} />
              <Route path="/timetable" element={<TimetablePage />} />
              <Route path="/holidays" element={<HolidaysPage />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/examinations" element={<ExaminationsPage />} />
              <Route path="/marks" element={<MarksPage />} />
              <Route path="/fees" element={<FeesPage />} />
              <Route path="/admissions" element={<AdmissionsPage />} />
              <Route path="/hostel" element={<HostelPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/achievements" element={<AchievementsPage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/audit-logs" element={<AuditLogsPage />} />
            </Route>

            {/* Faculty routes */}
            <Route element={<ProtectedRoute roles={['FACULTY']} />}>
              <Route path="/faculty/attendance" element={<FacultyAttendancePage />} />
              <Route path="/faculty/marks" element={<FacultyMarksPage />} />
              <Route path="/faculty/timetable" element={<FacultyTimetablePage />} />
              <Route path="/faculty/students" element={<FacultyStudentsPage />} />
            </Route>

            {/* Student routes */}
            <Route element={<ProtectedRoute roles={['STUDENT']} />}>
              <Route path="/student/timetable" element={<StudentTimetablePage />} />
              <Route path="/student/attendance" element={<StudentAttendancePage />} />
              <Route path="/student/results" element={<StudentResultsPage />} />
              <Route path="/student/fees" element={<StudentFeesPage />} />
              <Route path="/student/assignments" element={<StudentAssignmentsPage />} />
              <Route path="/student/profile" element={<StudentProfilePage />} />
            </Route>

            {/* Admin + Faculty shared routes */}
            <Route element={<ProtectedRoute roles={['ADMIN', 'FACULTY']} />}>
              <Route path="/online-classes" element={<OnlineClassesPage />} />
              <Route path="/assignments" element={<AssignmentsPage />} />
            </Route>

            {/* Shared routes */}
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
