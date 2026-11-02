import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, homeFor } from './auth.jsx';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';

import Login from './pages/Login.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import Students from './pages/admin/Students.jsx';
import People from './pages/admin/People.jsx';
import Batches from './pages/admin/Batches.jsx';
import Fees from './pages/admin/Fees.jsx';
import Reports from './pages/admin/Reports.jsx';
import TeacherHome from './pages/teacher/Home.jsx';
import TeacherAttendance from './pages/teacher/Attendance.jsx';
import ParentHome from './pages/parent/Home.jsx';

// Only logged-in users with one of the allowed roles may see the route
function Protected({ roles, children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

export default function App() {
  const { user, ready } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={ready && user ? <Navigate to={homeFor(user.role)} replace /> : <Login />} />

      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/admin" element={<Protected roles={['admin']}><AdminDashboard /></Protected>} />
        <Route path="/admin/students" element={<Protected roles={['admin']}><Students /></Protected>} />
        <Route path="/admin/people" element={<Protected roles={['admin']}><People /></Protected>} />
        <Route path="/admin/batches" element={<Protected roles={['admin']}><Batches /></Protected>} />
        <Route path="/admin/fees" element={<Protected roles={['admin']}><Fees /></Protected>} />
        <Route path="/admin/reports" element={<Protected roles={['admin']}><Reports /></Protected>} />

        <Route path="/teacher" element={<Protected roles={['teacher']}><TeacherHome /></Protected>} />
        <Route path="/teacher/batch/:batchId" element={<Protected roles={['teacher']}><TeacherAttendance /></Protected>} />

        <Route path="/parent" element={<Protected roles={['parent']}><ParentHome /></Protected>} />
      </Route>

      <Route path="*" element={<Navigate to={user ? homeFor(user.role) : '/login'} replace />} />
    </Routes>
  );
}
