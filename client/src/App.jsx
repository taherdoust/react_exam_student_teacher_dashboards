import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import { useContext } from 'react';
import { AuthContext } from './contexts/AuthContext';

export default function App() {
  const { user } = useContext(AuthContext);

  if (user === undefined) return <p>Loading...</p>;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {user && user.role === 'teacher' && (
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
      )}
      {user && user.role === 'student' && (
        <Route path="/student/dashboard" element={<StudentDashboard />} />
      )}
      <Route path="*" element={<Navigate to={user ? `/${user.role}/dashboard` : '/login'} />} />
    </Routes>
  );
}
