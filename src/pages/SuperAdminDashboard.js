import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { usernameToEmail } from '../utils/authEmail';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

export default function SuperAdminDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('classes');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data
  const [classes, setClasses] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [students, setStudents] = useState([]);

  // Forms
  const [className, setClassName] = useState('');
  const [facName, setFacName] = useState('');
  const [facUsername, setFacUsername] = useState('');
  const [facPassword, setFacPassword] = useState('');
  const [stuName, setStuName] = useState('');
  const [stuUsername, setStuUsername] = useState('');
  const [stuPassword, setStuPassword] = useState('');

  // Assign forms
  const [assignFacClassId, setAssignFacClassId] = useState('');
  const [assignFacId, setAssignFacId] = useState('');
  const [assignStuClassId, setAssignStuClassId] = useState('');
  const [assignStuId, setAssignStuId] = useState('');

  const deptId = profile?.department_id;

  const fetchData = useCallback(async () => {
    if (!deptId) return;
    const [classRes, facRes, stuRes] = await Promise.all([
      supabase.from('classes').select('*').eq('department_id', deptId).order('created_at'),
      supabase.from('profiles').select('*').eq('department_id', deptId).eq('role', 'faculty').order('created_at'),
      supabase.from('profiles').select('*').eq('department_id', deptId).eq('role', 'student').order('created_at'),
    ]);
    if (classRes.data) setClasses(classRes.data);
    if (facRes.data) setFaculty(facRes.data);
    if (stuRes.data) setStudents(stuRes.data);
  }, [deptId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const clearMsg = () => { setError(''); setSuccess(''); };

  const createClass = async (e) => {
    e.preventDefault();
    clearMsg();
    if (!className.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('classes').insert({
        name: className.trim(),
        department_id: deptId,
      });
      if (error) throw error;
      setSuccess('Class created!');
      setClassName('');
      await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const createFaculty = async (e) => {
    e.preventDefault();
    clearMsg();
    setLoading(true);
    try {
      const fakeEmail = usernameToEmail(facUsername);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: fakeEmail,
        password: facPassword,
        options: { data: { full_name: facName, role: 'faculty', username: facUsername.trim() } },
      });
      if (signUpError) throw signUpError;
      if (data.user) {
        await supabase.from('profiles').update({
          role: 'faculty',
          department_id: deptId,
          full_name: facName,
          username: facUsername.trim(),
        }).eq('id', data.user.id);
      }
      setSuccess('Faculty created!');
      setFacName(''); setFacUsername(''); setFacPassword('');
      await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const createStudent = async (e) => {
    e.preventDefault();
    clearMsg();
    setLoading(true);
    try {
      const fakeEmail = usernameToEmail(stuUsername);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: fakeEmail,
        password: stuPassword,
        options: { data: { full_name: stuName, role: 'student', username: stuUsername.trim() } },
      });
      if (signUpError) throw signUpError;
      if (data.user) {
        await supabase.from('profiles').update({
          role: 'student',
          department_id: deptId,
          full_name: stuName,
          username: stuUsername.trim(),
        }).eq('id', data.user.id);
      }
      setSuccess('Student created!');
      setStuName(''); setStuUsername(''); setStuPassword('');
      await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const assignFacultyToClass = async (e) => {
    e.preventDefault();
    clearMsg();
    if (!assignFacClassId || !assignFacId) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('class_faculty').insert({
        class_id: assignFacClassId,
        faculty_id: assignFacId,
      });
      if (error) throw error;
      setSuccess('Faculty assigned to class!');
      setAssignFacClassId(''); setAssignFacId('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const assignStudentToClass = async (e) => {
    e.preventDefault();
    clearMsg();
    if (!assignStuClassId || !assignStuId) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('class_students').insert({
        class_id: assignStuClassId,
        student_id: assignStuId,
      });
      if (error) throw error;
      setSuccess('Student added to class!');
      setAssignStuClassId(''); setAssignStuId('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const tabs = [
    { key: 'classes', label: 'Classes' },
    { key: 'faculty', label: 'Faculty' },
    { key: 'students', label: 'Students' },
    { key: 'assign', label: 'Assign' },
  ];

  return (
    <div className="dashboard">
      <Navbar />
      <div className="container">
        <h2>Super Admin Dashboard</h2>

        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}

        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => { setTab(t.key); clearMsg(); }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* CLASSES TAB */}
        {tab === 'classes' && (
          <div className="card">
            <h3>Create Class</h3>
            <form onSubmit={createClass} className="form-row">
              <input
                type="text"
                placeholder="Class Name"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
              />
              <button className="btn" type="submit" disabled={loading}>Create</button>
            </form>
            <h4>Existing Classes ({classes.length})</h4>
            {classes.length === 0 ? (
              <p className="text-muted">No classes yet.</p>
            ) : (
              <table className="table">
                <thead><tr><th>Name</th><th>Created</th></tr></thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id}><td>{c.name}</td><td>{new Date(c.created_at).toLocaleDateString()}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* FACULTY TAB */}
        {tab === 'faculty' && (
          <div className="card">
            <h3>Create Faculty Account</h3>
            <form onSubmit={createFaculty}>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" value={facName} onChange={(e) => setFacName(e.target.value)} placeholder="Full Name" />
              </div>
              <div className="form-group">
                <label>Username</label>
                <input type="text" value={facUsername} onChange={(e) => setFacUsername(e.target.value)} placeholder="Username (used for login)" />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" value={facPassword} onChange={(e) => setFacPassword(e.target.value)} placeholder="Password" />
              </div>
              <button className="btn" type="submit" disabled={loading}>Create Faculty</button>
            </form>
            <h4>Faculty List ({faculty.length})</h4>
            {faculty.length === 0 ? (
              <p className="text-muted">No faculty yet.</p>
            ) : (
              <table className="table">
                <thead><tr><th>Name</th><th>Username</th></tr></thead>
                <tbody>
                  {faculty.map((f) => (
                    <tr key={f.id}><td>{f.full_name}</td><td>{f.username}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* STUDENTS TAB */}
        {tab === 'students' && (
          <div className="card">
            <h3>Create Student Account</h3>
            <form onSubmit={createStudent}>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" value={stuName} onChange={(e) => setStuName(e.target.value)} placeholder="Full Name" />
              </div>
              <div className="form-group">
                <label>Username</label>
                <input type="text" value={stuUsername} onChange={(e) => setStuUsername(e.target.value)} placeholder="Username (used for login)" />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" value={stuPassword} onChange={(e) => setStuPassword(e.target.value)} placeholder="Password" />
              </div>
              <button className="btn" type="submit" disabled={loading}>Create Student</button>
            </form>
            <h4>Student List ({students.length})</h4>
            {students.length === 0 ? (
              <p className="text-muted">No students yet.</p>
            ) : (
              <table className="table">
                <thead><tr><th>Name</th><th>Username</th></tr></thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}><td>{s.full_name}</td><td>{s.username}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ASSIGN TAB */}
        {tab === 'assign' && (
          <div className="card">
            <h3>Assign Faculty to Class</h3>
            <form onSubmit={assignFacultyToClass} className="form-row">
              <select value={assignFacClassId} onChange={(e) => setAssignFacClassId(e.target.value)}>
                <option value="">-- Select Class --</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={assignFacId} onChange={(e) => setAssignFacId(e.target.value)}>
                <option value="">-- Select Faculty --</option>
                {faculty.map((f) => <option key={f.id} value={f.id}>{f.full_name} ({f.username})</option>)}
              </select>
              <button className="btn" type="submit" disabled={loading}>Assign</button>
            </form>

            <h3 style={{ marginTop: '2rem' }}>Add Student to Class</h3>
            <form onSubmit={assignStudentToClass} className="form-row">
              <select value={assignStuClassId} onChange={(e) => setAssignStuClassId(e.target.value)}>
                <option value="">-- Select Class --</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={assignStuId} onChange={(e) => setAssignStuId(e.target.value)}>
                <option value="">-- Select Student --</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.username})</option>)}
              </select>
              <button className="btn" type="submit" disabled={loading}>Add to Class</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
