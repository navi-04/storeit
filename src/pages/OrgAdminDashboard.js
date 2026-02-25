import React, { useState, useEffect } from 'react';
import { supabase, supabaseAdmin } from '../supabaseClient';
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

  // Store created credentials temporarily
  const [createdSuperAdmins, setCreatedSuperAdmins] = useState({});

  // Edit modals
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [editingSuperAdmin, setEditingSuperAdmin] = useState(null);

  // Password visibility
  const [visiblePasswords, setVisiblePasswords] = useState({});

  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

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

  const deleteDepartment = async (id) => {
    if (!window.confirm('Delete this department? All related classes, users (faculty, students, super admins), and their data will be permanently deleted. This cannot be undone.')) return;
    setError(''); setSuccess('');
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) { setError(error.message); return; }
    setSuccess('Department deleted!');
    loadDepartments();
    loadSuperAdmins();
  };

  const updateDepartment = async (e) => {
    e.preventDefault();
    if (!editingDepartment?.name.trim()) return;
    setDeptLoading(true);
    setError('');
    setSuccess('');
    try {
      const { error } = await supabase.from('departments').update({ name: editingDepartment.name.trim() }).eq('id', editingDepartment.id);
      if (error) throw error;
      setSuccess('Department updated!');
      setEditingDepartment(null);
      loadDepartments();
    } catch (err) {
      setError(err.message);
    }
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
      // Use supabaseAdmin (non-session-persisting client) so admin session is NOT replaced
      const fakeEmail = usernameToEmail(saForm.username);
      const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
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
            password: saForm.password,
          })
          .eq('id', signUpData.user.id);
        if (profileError) throw profileError;
        // Store credentials temporarily
        setCreatedSuperAdmins(prev => ({ ...prev, [signUpData.user.id]: { username: saForm.username, password: saForm.password } }));
        // Auto-show password for newly created super admin
        setVisiblePasswords(prev => ({ ...prev, [signUpData.user.id]: true }));
      }

      setSuccess('Super Admin created!');
      setSaForm({ username: '', password: '', full_name: '', department_id: '' });
      loadSuperAdmins();
    } catch (err) {
      setError(err.message);
    }
    setSaLoading(false);
  };

  const deleteSuperAdmin = async (id, username) => {
    if (!window.confirm(`Delete super admin "${username}"? This cannot be undone.`)) return;
    setError(''); setSuccess('');
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      // Remove from created super admins
      setCreatedSuperAdmins(prev => {
        const newAdmins = { ...prev };
        delete newAdmins[id];
        return newAdmins;
      });
      setSuccess('Super Admin deleted!');
      loadSuperAdmins();
    } catch (err) { setError(err.message); }
  };

  const updateSuperAdmin = async (e) => {
    e.preventDefault();
    setSaLoading(true);
    setError('');
    setSuccess('');
    try {
      const { error } = await supabase.from('profiles')
        .update({ 
          full_name: editingSuperAdmin.full_name, 
          username: editingSuperAdmin.username,
          department_id: editingSuperAdmin.department_id
        })
        .eq('id', editingSuperAdmin.id);
      if (error) throw error;
      setSuccess('Super Admin updated!');
      setEditingSuperAdmin(null);
      loadSuperAdmins();
    } catch (err) {
      setError(err.message);
    }
    setSaLoading(false);
  };

  const clearDatabase = async () => {
    const confirmText = 'DELETE EVERYTHING';
    const userInput = window.prompt(
      `⚠️ DANGER: This will permanently delete ALL data from the database!\n\n` +
      `This includes:\n` +
      `- All departments\n` +
      `- All users (super admins, faculty, students)\n` +
      `- All classes\n` +
      `- All forms and form data\n` +
      `- Everything except your org admin account\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Type "${confirmText}" to confirm:`
    );
    
    if (userInput !== confirmText) {
      if (userInput !== null) {
        setError('Database clear cancelled - confirmation text did not match.');
      }
      return;
    }

    setError('');
    setSuccess('');
    setDeptLoading(true);

    try {
      // Get current user ID to preserve org admin account
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Step 1: Delete all departments (cascades to classes and related data)
      const { error: deptError } = await supabase.from('departments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (deptError) throw deptError;

      // Step 2: Delete all profiles except current org admin
      const { error: profileError } = await supabase.from('profiles').delete().neq('id', user.id);
      if (profileError) throw profileError;

      setSuccess('✅ Database cleared successfully! All data has been deleted except your org admin account.');
      loadDepartments();
      loadSuperAdmins();
    } catch (err) {
      setError(`Failed to clear database: ${err.message}`);
    } finally {
      setDeptLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <Navbar />
      <div className="container">
        <div style={{ position: 'relative' }}>
          <h2>Org Admin Dashboard</h2>
        </div>

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

          <h4>Existing Departments ({departments.length})</h4>
          {departments.length === 0 ? (
            <p className="text-muted">No departments yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Created</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>{new Date(d.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => setEditingDepartment(d)} style={{ marginRight: '0.5rem' }}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteDepartment(d.id)}>Delete</button>
                    </td>
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

          <h4>Existing Super Admins ({superAdmins.length})</h4>
          {superAdmins.length === 0 ? (
            <p className="text-muted">No super admins yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Username</th><th>Password</th><th>Department</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {superAdmins.map((sa) => (
                  <tr key={sa.id}>
                    <td>{sa.full_name}</td>
                    <td>{sa.username}</td>
                    <td>
                      {sa.password || createdSuperAdmins[sa.id] ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ color: '#059669', fontFamily: 'monospace', fontWeight: 'bold' }}>
                            {visiblePasswords[sa.id] ? (sa.password || createdSuperAdmins[sa.id]?.password) : '••••••••'}
                          </span>
                          <button
                            onClick={() => togglePasswordVisibility(sa.id)}
                            className="password-toggle-btn"
                            title={visiblePasswords[sa.id] ? 'Hide password' : 'Show password'}
                          >
                            {visiblePasswords[sa.id] ? '🙈' : '👁️'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted">••••••••</span>
                      )}
                    </td>
                    <td>{sa.departments?.name || '—'}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => setEditingSuperAdmin(sa)} style={{ marginRight: '0.5rem' }}>Edit</button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteSuperAdmin(sa.id, sa.username)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Danger Zone - Clear Database */}
        <section className="card danger-zone-card">
          <h3 className="danger-title">⚠️ Danger Zone</h3>
          <div className="danger-warning-box">
            <p className="danger-warning-title">Clear All Database</p>
            <p className="danger-warning-text">
              This will permanently delete <strong>ALL</strong> data from the database including all departments, 
              users (super admins, faculty, students), classes, forms, and form submissions. 
              Only your org admin account will be preserved.
            </p>
          </div>
          <button 
            className="btn btn-danger-zone" 
            onClick={clearDatabase}
            disabled={deptLoading}
          >
            {deptLoading ? 'Clearing...' : '🗑️ Clear All Database'}
          </button>
        </section>
      </div>

      {/* Edit Department Modal */}
      {editingDepartment && (
        <div className="modal-overlay" onClick={() => setEditingDepartment(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Department</h3>
            <form onSubmit={updateDepartment}>
              <div className="form-group">
                <label>Department Name</label>
                <input
                  type="text"
                  value={editingDepartment.name}
                  onChange={(e) => setEditingDepartment({ ...editingDepartment, name: e.target.value })}
                  placeholder="Department Name"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn" type="submit" disabled={deptLoading}>
                  {deptLoading ? 'Updating...' : 'Update'}
                </button>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => setEditingDepartment(null)}
                  style={{ background: '#6b7280', color: 'white' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Super Admin Modal */}
      {editingSuperAdmin && (
        <div className="modal-overlay" onClick={() => setEditingSuperAdmin(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Super Admin</h3>
            <form onSubmit={updateSuperAdmin}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={editingSuperAdmin.full_name}
                  onChange={(e) => setEditingSuperAdmin({ ...editingSuperAdmin, full_name: e.target.value })}
                  placeholder="Full Name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={editingSuperAdmin.username}
                  onChange={(e) => setEditingSuperAdmin({ ...editingSuperAdmin, username: e.target.value })}
                  placeholder="Username"
                  required
                />
              </div>
              <div className="form-group">
                <label>Department</label>
                <select
                  value={editingSuperAdmin.department_id || ''}
                  onChange={(e) => setEditingSuperAdmin({ ...editingSuperAdmin, department_id: e.target.value })}
                  required
                >
                  <option value="">-- Select Department --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn" type="submit" disabled={saLoading}>
                  {saLoading ? 'Updating...' : 'Update'}
                </button>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => setEditingSuperAdmin(null)}
                  style={{ background: '#6b7280', color: 'white' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
