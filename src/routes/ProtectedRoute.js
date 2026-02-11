import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    // Profile is still being fetched — show loading instead of redirecting
    return <div className="loading-screen">Loading profile...</div>;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    // Redirect to their correct dashboard
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
