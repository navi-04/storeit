import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user, profile, configError, authError } = useAuth();
  const navigate = useNavigate();

  // Once profile is loaded after sign-in, redirect
  useEffect(() => {
    if (profile) {
      const roleRoutes = {
        org_admin: '/org',
        super_admin: '/super',
        faculty: '/faculty',
        student: '/student',
      };
      navigate(roleRoutes[profile.role] || '/', { replace: true });
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (authError) {
      setError(authError);
      setLoading(false);
    }

    if (user && !profile && !authError) {
      setLoading(true);
    }

    if (!user) {
      setLoading(false);
    }
  }, [authError, profile, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(username, password);
      // Don't navigate here — useEffect handles it once profile loads
    } catch (err) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>StoreIt</h1>
        <p className="text-muted">Student Detail Management</p>
        <form onSubmit={handleSubmit}>
          {configError && <div className="error-msg">{configError}</div>}
          {error && <div className="error-msg">{error}</div>}
          <div className="form-group">
            <label>Username or Email</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter your username or email"
              autoComplete="username"
              disabled={Boolean(configError)}
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              disabled={Boolean(configError)}
            />
          </div>
          <button className="btn btn-block" type="submit" disabled={loading || Boolean(configError)}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
