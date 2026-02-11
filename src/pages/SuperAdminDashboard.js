import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, supabaseAdmin } from '../supabaseClient';
import { usernameToEmail } from '../utils/authEmail';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import FormBuilder from '../components/FormBuilder';
import * as XLSX from 'xlsx';

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

  // Faculty sections management
  const [fieldClassId, setFieldClassId] = useState('');
  const [facultySections, setFacultySections] = useState([]);

  // Assigned faculty/students per class
  const [classFacultyMap, setClassFacultyMap] = useState({});
  const [classStudentMap, setClassStudentMap] = useState({});

  // Import
  const [importClassId, setImportClassId] = useState('');
  const [importPreview, setImportPreview] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef(null);

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

    // Fetch class assignments
    const [cfRes, csRes] = await Promise.all([
      supabase.from('class_faculty').select('*, profiles(id, full_name, username)').order('created_at'),
      supabase.from('class_students').select('*, profiles(id, full_name, username)').order('created_at'),
    ]);
    const cfMap = {};
    (cfRes.data || []).forEach((cf) => {
      if (!cfMap[cf.class_id]) cfMap[cf.class_id] = [];
      cfMap[cf.class_id].push(cf);
    });
    setClassFacultyMap(cfMap);
    const csMap = {};
    (csRes.data || []).forEach((cs) => {
      if (!csMap[cs.class_id]) csMap[cs.class_id] = [];
      csMap[cs.class_id].push(cs);
    });
    setClassStudentMap(csMap);
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
      // Use supabaseAdmin so admin session is NOT replaced
      const { data, error: signUpError } = await supabaseAdmin.auth.signUp({
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
      // Use supabaseAdmin so admin session is NOT replaced
      const { data, error: signUpError } = await supabaseAdmin.auth.signUp({
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
      await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ---- DELETE FUNCTIONS ----

  const deleteClass = async (id, name) => {
    if (!window.confirm(`Delete class "${name}"? All fields and assignments will be removed.`)) return;
    clearMsg();
    try {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
      setSuccess('Class deleted!');
      await fetchData();
    } catch (err) { setError(err.message); }
  };

  const deleteFacultyAccount = async (id, username) => {
    if (!window.confirm(`Delete faculty "${username}"? This cannot be undone.`)) return;
    clearMsg();
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      setSuccess('Faculty deleted!');
      await fetchData();
    } catch (err) { setError(err.message); }
  };

  const deleteStudentAccount = async (id, username) => {
    if (!window.confirm(`Delete student "${username}"? This cannot be undone.`)) return;
    clearMsg();
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
      setSuccess('Student deleted!');
      await fetchData();
    } catch (err) { setError(err.message); }
  };

  const unassignFaculty = async (assignmentId) => {
    if (!window.confirm('Remove this faculty from the class?')) return;
    clearMsg();
    try {
      const { error } = await supabase.from('class_faculty').delete().eq('id', assignmentId);
      if (error) throw error;
      setSuccess('Faculty removed from class!');
      await fetchData();
    } catch (err) { setError(err.message); }
  };

  const unassignStudent = async (assignmentId) => {
    if (!window.confirm('Remove this student from the class?')) return;
    clearMsg();
    try {
      const { error } = await supabase.from('class_students').delete().eq('id', assignmentId);
      if (error) throw error;
      setSuccess('Student removed from class!');
      await fetchData();
    } catch (err) { setError(err.message); }
  };

  // ---- FACULTY SECTIONS MANAGEMENT ----

  const fetchFacultySections = useCallback(async () => {
    if (!fieldClassId) { setFacultySections([]); return; }
    const { data: secData, error: secErr } = await supabase
      .from('faculty_sections')
      .select('*')
      .eq('class_id', fieldClassId)
      .order('section_order');
    if (secErr) { setError(secErr.message); return; }
    // Fetch fields for each section
    const sectionIds = (secData || []).map((s) => s.id);
    let fieldsData = [];
    if (sectionIds.length > 0) {
      const { data: fData } = await supabase
        .from('faculty_section_fields')
        .select('*')
        .in('section_id', sectionIds)
        .order('field_order');
      fieldsData = fData || [];
    }
    const sections = (secData || []).map((s) => ({
      ...s,
      fields: fieldsData.filter((f) => f.section_id === s.id),
    }));
    setFacultySections(sections);
  }, [fieldClassId]);

  useEffect(() => { fetchFacultySections(); }, [fetchFacultySections]);

  const saveFacultySection = async (sectionData) => {
    clearMsg();
    setLoading(true);
    try {
      const { data: sec, error: secErr } = await supabase.from('faculty_sections').insert({
        class_id: fieldClassId,
        section_name: sectionData.section_name,
        section_order: facultySections.length,
        created_by: profile.id,
      }).select().single();
      if (secErr) throw secErr;
      // Insert fields
      for (let i = 0; i < sectionData.fields.length; i++) {
        const f = sectionData.fields[i];
        const { error: fErr } = await supabase.from('faculty_section_fields').insert({
          section_id: sec.id,
          field_name: f.field_name,
          field_type: f.field_type,
          field_options: f.field_options || [],
          field_order: i,
          required: f.required || false,
          upload_link: f.upload_link || '',
        });
        if (fErr) throw fErr;
      }
      setSuccess('Faculty section created!');
      await fetchFacultySections();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const deleteFacultySection = async (sectionId) => {
    if (!window.confirm('Delete this section and all its fields?')) return;
    clearMsg();
    setLoading(true);
    try {
      const { error } = await supabase.from('faculty_sections').delete().eq('id', sectionId);
      if (error) throw error;
      await fetchFacultySections();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const deleteFacultySectionField = async (fieldId) => {
    clearMsg();
    setLoading(true);
    try {
      const { error } = await supabase.from('faculty_section_fields').delete().eq('id', fieldId);
      if (error) throw error;
      await fetchFacultySections();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const addFacultyFieldToSection = async (sectionId, fieldData) => {
    clearMsg();
    setLoading(true);
    try {
      const { error } = await supabase.from('faculty_section_fields').insert({
        section_id: sectionId,
        field_name: fieldData.field_name,
        field_type: fieldData.field_type,
        field_options: fieldData.field_options || [],
        field_order: fieldData.field_order || 0,
        required: fieldData.required || false,
        upload_link: fieldData.upload_link || '',
      });
      if (error) throw error;
      setSuccess('Field added!');
      await fetchFacultySections();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ---- EXCEL IMPORT ----

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFileName(file.name);
    setError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        // Normalize column names
        const normalized = rows.map((row) => {
          const r = {};
          Object.keys(row).forEach((k) => {
            r[k.trim().toLowerCase()] = String(row[k]).trim();
          });
          return r;
        }).filter((r) => r.username);
        if (normalized.length === 0) {
          setError('No valid rows found. Excel must have "username" and "password" columns.');
          setImportPreview([]);
          return;
        }
        // Check for required columns
        const first = normalized[0];
        if (!('password' in first) && !('pass' in first)) {
          setError('Excel must have a "password" (or "pass") column.');
          setImportPreview([]);
          return;
        }
        setImportPreview(normalized.map((r) => ({
          username: r.username,
          password: r.password || r.pass || '',
          full_name: r.full_name || r.fullname || r.name || '',
        })));
      } catch (err) {
        setError('Failed to parse Excel file: ' + err.message);
        setImportPreview([]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportStudents = async () => {
    if (!importClassId || importPreview.length === 0) return;
    clearMsg();
    setLoading(true);
    let created = 0;
    let failed = 0;
    try {
      for (const stu of importPreview) {
        try {
          if (!stu.username || !stu.password) { failed++; continue; }
          const fakeEmail = usernameToEmail(stu.username);
          const { data: signUpData, error: signUpErr } = await supabaseAdmin.auth.signUp({
            email: fakeEmail,
            password: stu.password,
            options: { data: { full_name: stu.full_name || '', role: 'student', username: stu.username } },
          });
          if (signUpErr) { failed++; continue; }
          if (signUpData.user) {
            await supabase.from('profiles').update({
              role: 'student',
              department_id: deptId,
              full_name: stu.full_name || '',
              username: stu.username,
            }).eq('id', signUpData.user.id);
            // Assign to class
            await supabase.from('class_students').insert({
              class_id: importClassId,
              student_id: signUpData.user.id,
            });
            created++;
          }
        } catch { failed++; }
      }
      setSuccess(`Import complete! ${created} students created${failed > 0 ? `, ${failed} failed` : ''}.`);
      setImportPreview([]);
      setImportFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const tabs = [
    { key: 'classes', label: 'Classes' },
    { key: 'faculty', label: 'Faculty' },
    { key: 'students', label: 'Students' },
    { key: 'import', label: 'Import Students' },
    { key: 'assign', label: 'Assign' },
    { key: 'faculty-fields', label: 'Faculty Sections' },
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
                <thead><tr><th>Name</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => deleteClass(c.id, c.name)}>Delete</button></td>
                    </tr>
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
                <thead><tr><th>Name</th><th>Username</th><th>Actions</th></tr></thead>
                <tbody>
                  {faculty.map((f) => (
                    <tr key={f.id}>
                      <td>{f.full_name}</td>
                      <td>{f.username}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => deleteFacultyAccount(f.id, f.username)}>Delete</button></td>
                    </tr>
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
                <thead><tr><th>Name</th><th>Username</th><th>Actions</th></tr></thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td>{s.full_name}</td>
                      <td>{s.username}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => deleteStudentAccount(s.id, s.username)}>Delete</button></td>
                    </tr>
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

            {/* Show currently assigned faculty per class */}
            {classes.map((c) => {
              const assigned = classFacultyMap[c.id] || [];
              if (assigned.length === 0) return null;
              return (
                <div key={c.id} style={{ marginTop: '1rem' }}>
                  <h4>{c.name} — Assigned Faculty</h4>
                  <table className="table">
                    <thead><tr><th>Name</th><th>Username</th><th>Actions</th></tr></thead>
                    <tbody>
                      {assigned.map((a) => (
                        <tr key={a.id}>
                          <td>{a.profiles?.full_name}</td>
                          <td>{a.profiles?.username}</td>
                          <td><button className="btn btn-sm btn-danger" onClick={() => unassignFaculty(a.id)}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}

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

            {/* Show currently assigned students per class */}
            {classes.map((c) => {
              const assigned = classStudentMap[c.id] || [];
              if (assigned.length === 0) return null;
              return (
                <div key={c.id} style={{ marginTop: '1rem' }}>
                  <h4>{c.name} — Assigned Students</h4>
                  <table className="table">
                    <thead><tr><th>Name</th><th>Username</th><th>Actions</th></tr></thead>
                    <tbody>
                      {assigned.map((a) => (
                        <tr key={a.id}>
                          <td>{a.profiles?.full_name}</td>
                          <td>{a.profiles?.username}</td>
                          <td><button className="btn btn-sm btn-danger" onClick={() => unassignStudent(a.id)}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {/* IMPORT STUDENTS TAB */}
        {tab === 'import' && (
          <div className="card">
            <h3>Import Students from Excel</h3>
            <p className="text-muted">Upload an Excel file (.xlsx, .xls) or CSV with columns: <strong>username</strong>, <strong>password</strong>, and optionally <strong>full_name</strong>. Each student will be created and assigned to the selected class.</p>
            <div className="form-group">
              <label>Select Class</label>
              <select value={importClassId} onChange={(e) => { setImportClassId(e.target.value); setImportPreview([]); setImportFileName(''); if(fileInputRef.current) fileInputRef.current.value = ''; }}>
                <option value="">-- Select Class --</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {importClassId && (
              <>
                <div className="form-group">
                  <label>Choose File</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                  />
                  {importFileName && <small className="text-muted">File: {importFileName}</small>}
                </div>
                {importPreview.length > 0 && (
                  <>
                    <h4>Preview ({importPreview.length} students)</h4>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Username</th>
                          <th>Password</th>
                          <th>Full Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((row, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td>{row.username}</td>
                            <td>{row.password ? '••••••' : <span style={{color:'red'}}>Missing</span>}</td>
                            <td>{row.full_name || row.username}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      className="btn"
                      onClick={handleImportStudents}
                      disabled={loading}
                    >
                      {loading ? 'Importing...' : `Import ${importPreview.length} Students`}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* FACULTY SECTIONS TAB */}
        {tab === 'faculty-fields' && (
          <div className="card">
            <h3>Manage Faculty Sections</h3>
            <p className="text-muted">Create sections with fields that faculty members must fill out for each class.</p>
            <div className="form-group">
              <label>Select Class</label>
              <select value={fieldClassId} onChange={(e) => { setFieldClassId(e.target.value); clearMsg(); }}>
                <option value="">-- Select Class --</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {fieldClassId && (
              <FormBuilder
                sections={facultySections}
                onSaveSection={saveFacultySection}
                onDeleteSection={deleteFacultySection}
                onDeleteField={deleteFacultySectionField}
                onAddField={addFacultyFieldToSection}
                loading={loading}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
