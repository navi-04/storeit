import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoadingOverlay, Center } from '@mantine/core';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import OrgAdminDashboard from './pages/OrgAdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import StudentDashboard from './pages/StudentDashboard';
import Footer from './components/Footer';

function RoleRedirect() {
  const { user, profile, loading } = useAuth();

  if (loading) return (
    <Center h="100vh">
      <LoadingOverlay visible={true} overlayProps={{ blur: 2 }} />
    </Center>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <Navigate to="/login" replace />;

  const roleRoutes = {
    org_admin: '/org',
    super_admin: '/super',
    faculty: '/faculty',
    student: '/student',
  };

  return <Navigate to={roleRoutes[profile.role] || '/login'} replace />;
}

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RoleRedirect />} />

          <Route
            path="/org"
            element={
              <ProtectedRoute allowedRoles={['org_admin']}>
                <OrgAdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/super"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/faculty"
            element={
              <ProtectedRoute allowedRoles={['faculty']}>
                <FacultyDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
      </AuthProvider>
    </HashRouter>
  );
}

export default App;
