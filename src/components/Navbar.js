import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  if (!profile) return null;

  const roleLabels = {
    org_admin: 'Org Admin',
    super_admin: 'Super Admin',
    faculty: 'Faculty',
    student: 'Student',
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">StoreIt</div>
      <div className="navbar-info">
        <span className="navbar-role">{roleLabels[profile.role]}</span>
        <span className="navbar-email">{profile.username}</span>
        <button className="btn btn-sm btn-outline" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
