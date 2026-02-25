import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Center, Loader, Text, Stack } from '@mantine/core';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Loader size="lg" color="indigo" />
          <Text c="dimmed">Loading...</Text>
        </Stack>
      </Center>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    const roleRoutes = {
      org_admin: '/org',
      super_admin: '/super',
      faculty: '/faculty',
      student: '/student',
    };
    return <Navigate to={roleRoutes[profile.role] || '/login'} replace />;
  }

  return children;
}
