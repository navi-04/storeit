import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
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
