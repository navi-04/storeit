import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { usernameToEmail } from '../utils/authEmail';
import Navbar from '../components/Navbar';

export default function OrgAdminDashboard() {
  // --- Departments ---
  const [departments, setDepartments] = useState([]);
  const [deptName, setDeptName] = useState('');
  const [deptLoading, setDeptLoading] = useState(false);

  // --- Super Admins ---
  const [superAdmins, setSuperAdmins] = useState([]);
  const [saForm, setSaForm] = useState({ username: '', password: '', full_name: '', department_id: '' });
  const [saLoading, setSaLoading] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadDepartments();
    loadSuperAdmins();
  }, []);

  const loadDepartments = async () => {
    const { data, error } = await supabase.from('departments').select('*').order('created_at');
    if (error) { setError(error.message); return; }
    setDepartments(data || []);
  };

  const loadSuperAdmins = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, departments(name)')
      .eq('role', 'super_admin')
      .order('created_at');
    if (error) { setError(error.message); return; }
    setSuperAdmins(data || []);
  };

  const createDepartment = async (e) => {
    e.preventDefault();
    if (!deptName.trim()) return;
    setDeptLoading(true);
    setError('');
    setSuccess('');
    const { error } = await supabase.from('departments').insert({ name: deptName.trim() });
    if (error) { setError(error.message); }
    else { setSuccess('Department created!'); setDeptName(''); loadDepartments(); }
    setDeptLoading(false);
  };

  const createSuperAdmin = async (e) => {
    e.preventDefault();
    if (!saForm.username || !saForm.password || !saForm.department_id) {
      setError('All fields required for Super Admin');
      return;
    }
    setSaLoading(true);
    setError('');
    setSuccess('');
    try {
      // Sign up the user with metadata
      const fakeEmail = usernameToEmail(saForm.username);
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: fakeEmail,
        password: saForm.password,
        options: {
          data: {
            full_name: saForm.full_name,
            role: 'super_admin',
            username: saForm.username.trim(),
          },
        },
      });
      if (signUpError) throw signUpError;

      // Update profile with department and role
      if (signUpData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            role: 'super_admin',
            department_id: saForm.department_id,
            full_name: saForm.full_name,
            username: saForm.username.trim(),
          })
          .eq('id', signUpData.user.id);
        if (profileError) throw profileError;
      }

      setSuccess('Super Admin created!');
      setSaForm({ username: '', password: '', full_name: '', department_id: '' });
      loadSuperAdmins();
    } catch (err) {
      setError(err.message);
    }
    setSaLoading(false);
  };

  return (
    <div className="dashboard">
      <Navbar />
      <div className="container">
        <h2>Org Admin Dashboard</h2>

        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}

        {/* Create Department */}
        <section className="card">
          <h3>Create Department</h3>
          <form onSubmit={createDepartment} className="form-row">
            <input
              type="text"
              placeholder="Department Name"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
            />
            <button className="btn" disabled={deptLoading}>
              {deptLoading ? 'Creating...' : 'Create'}
            </button>
          </form>

          <h4>Existing Departments</h4>
          {departments.length === 0 ? (
            <p className="text-muted">No departments yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Created</th></tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>{new Date(d.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Create Super Admin */}
        <section className="card">
          <h3>Create Super Admin</h3>
          <form onSubmit={createSuperAdmin}>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={saForm.full_name}
                onChange={(e) => setSaForm({ ...saForm, full_name: e.target.value })}
                placeholder="Full Name"
              />
            </div>
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={saForm.username}
                onChange={(e) => setSaForm({ ...saForm, username: e.target.value })}
                placeholder="Username (used for login)"
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={saForm.password}
                onChange={(e) => setSaForm({ ...saForm, password: e.target.value })}
                placeholder="Min 6 characters"
                required
              />
            </div>
            <div className="form-group">
              <label>Department</label>
              <select
                value={saForm.department_id}
                onChange={(e) => setSaForm({ ...saForm, department_id: e.target.value })}
                required
              >
                <option value="">-- Select Department --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <button className="btn" disabled={saLoading}>
              {saLoading ? 'Creating...' : 'Create Super Admin'}
            </button>
          </form>

          <h4>Existing Super Admins</h4>
          {superAdmins.length === 0 ? (
            <p className="text-muted">No super admins yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Username</th><th>Department</th></tr>
              </thead>
              <tbody>
                {superAdmins.map((sa) => (
                  <tr key={sa.id}>
                    <td>{sa.full_name}</td>
                    <td>{sa.username}</td>
                    <td>{sa.departments?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
