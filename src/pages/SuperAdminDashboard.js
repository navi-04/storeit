import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase, supabaseAdmin } from '../supabaseClient';
import { usernameToEmail } from '../utils/authEmail';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import FormBuilder from '../components/FormBuilder';
import * as XLSX from 'xlsx';

export function SuperAdminDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('classes');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data
  const [classes, setClasses] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [students, setStudents] = useState([]);

  // Store created credentials temporarily
  const [createdUsers, setCreatedUsers] = useState({});

  // Forms
  const [className, setClassName] = useState('');
  const [facName, setFacName] = useState('');
  const [facUsername, setFacUsername] = useState('');
  const [facPassword, setFacPassword] = useState('');
  const [stuName, setStuName] = useState('');
  const [stuUsername, setStuUsername] = useState('');
  const [stuPassword, setStuPassword] = useState('');

  // Edit modals
  const [editingClass, setEditingClass] = useState(null);
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);

  // Password visibility
  const [visiblePasswords, setVisiblePasswords] = useState({});

  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Assign forms
  const [assignFacClassId, setAssignFacClassId] = useState('');
  const [assignFacId, setAssignFacId] = useState('');
  const [assignStuClassId, setAssignStuClassId] = useState('');
  const [assignStuId, setAssignStuId] = useState('');

  // Student sections management (super admin creates these)
  const [studentFieldClassId, setStudentFieldClassId] = useState('');
  const [studentSections, setStudentSections] = useState([]);

  // Faculty sections management (super admin creates these)
  const [facultyFieldClassId, setFacultyFieldClassId] = useState('');
  const [facultySections, setFacultySections] = useState([]);

  // Assigned faculty/students per class
  const [classFacultyMap, setClassFacultyMap] = useState({});
  const [classStudentMap, setClassStudentMap] = useState({});

  // Import
  const [importClassId, setImportClassId] = useState('');
  const [importPreview, setImportPreview] = useState([]);
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef(null);

  // View data
  const [viewClassId, setViewClassId] = useState('');
  const [viewStudentData, setViewStudentData] = useState({ sections: [], students: [], submissions: {} });
  const [viewFacultyData, setViewFacultyData] = useState({ sections: [], faculty: [], submissions: {} });

  // Memoize deptId to prevent unnecessary re-renders
  const deptId = useMemo(() => profile?.department_id, [profile?.department_id]);

  const fetchData = useCallback(async () => {
    if (!deptId) return;
    setDataLoading(true);
    // Silent background refresh - no loading state to avoid UI flicker
    const [classRes, facRes, stuRes] = await Promise.all([
      supabase.from('classes').select('*').eq('department_id', deptId).order('created_at'),
      supabase.from('profiles').select('*').eq('department_id', deptId).eq('role', 'faculty').order('created_at'),
      supabase.from('profiles').select('*').eq('department_id', deptId).eq('role', 'student').order('created_at'),
    ]);
    if (classRes.data) setClasses(classRes.data);
    if (facRes.data) setFaculty(facRes.data);
    if (stuRes.data) setStudents(stuRes.data);

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
    setDataLoading(false);
  }, [deptId]);

  // Only fetch once on mount or when deptId changes
  useEffect(() => { 
    if (deptId) fetchData(); 
  }, [deptId, fetchData]);

  const clearMsg = () => { setError(''); setSuccess(''); };

  // ======================== CLASS CRUD ========================

  const createClass = async (e) => {
    e.preventDefault(); clearMsg();
    if (!className.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('classes').insert({ name: className.trim(), department_id: deptId });
      if (error) throw error;
      setSuccess('Class created!'); setClassName(''); await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const deleteClass = async (id, name) => {
    if (!window.confirm(`Delete class "${name}"? All fields and assignments will be removed.`)) return;
    clearMsg();
    try {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
      setSuccess('Class deleted!'); await fetchData();
    } catch (err) { setError(err.message); }
  };

  const updateClass = async (e) => {
    e.preventDefault(); clearMsg();
    if (!editingClass?.name.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('classes').update({ name: editingClass.name.trim() }).eq('id', editingClass.id);
      if (error) throw error;
      setSuccess('Class updated!'); setEditingClass(null); await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ======================== USER CREATION ========================

  const createFaculty = async (e) => {
    e.preventDefault(); clearMsg(); setLoading(true);
    try {
      const fakeEmail = usernameToEmail(facUsername);
      const { data, error: signUpError } = await supabaseAdmin.auth.signUp({
        email: fakeEmail, password: facPassword,
        options: { data: { full_name: facName, role: 'faculty', username: facUsername.trim() } },
      });
      if (signUpError) throw signUpError;
      if (data.user) {
        await supabase.from('profiles').update({ role: 'faculty', department_id: deptId, full_name: facName, username: facUsername.trim(), password: facPassword }).eq('id', data.user.id);
        // Store credentials temporarily
        setCreatedUsers(prev => ({ ...prev, [data.user.id]: { username: facUsername, password: facPassword, type: 'faculty' } }));
        // Auto-show password for newly created faculty
        setVisiblePasswords(prev => ({ ...prev, [data.user.id]: true }));
      }
      setSuccess('Faculty created!'); setFacName(''); setFacUsername(''); setFacPassword(''); await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const createStudent = async (e) => {
    e.preventDefault(); clearMsg(); setLoading(true);
    try {
      const fakeEmail = usernameToEmail(stuUsername);
      const { data, error: signUpError } = await supabaseAdmin.auth.signUp({
        email: fakeEmail, password: stuPassword,
        options: { data: { full_name: stuName, role: 'student', username: stuUsername.trim() } },
      });
      if (signUpError) throw signUpError;
      if (data.user) {
        await supabase.from('profiles').update({ role: 'student', department_id: deptId, full_name: stuName, username: stuUsername.trim(), password: stuPassword }).eq('id', data.user.id);
        // Store credentials temporarily
        setCreatedUsers(prev => ({ ...prev, [data.user.id]: { username: stuUsername, password: stuPassword, type: 'student' } }));
        // Auto-show password for newly created student
        setVisiblePasswords(prev => ({ ...prev, [data.user.id]: true }));
      }
      setSuccess('Student created!'); setStuName(''); setStuUsername(''); setStuPassword(''); await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const deleteFacultyAccount = async (id, username) => {
    if (!window.confirm(`Delete faculty "${username}"? This cannot be undone.`)) return;
    clearMsg();
    try { 
      const { error } = await supabase.from('profiles').delete().eq('id', id); 
      if (error) throw error; 
      // Remove from created users
      setCreatedUsers(prev => {
        const newUsers = { ...prev };
        delete newUsers[id];
        return newUsers;
      });
      setSuccess('Faculty deleted!'); await fetchData(); 
    }
    catch (err) { setError(err.message); }
  };

  const updateFaculty = async (e) => {
    e.preventDefault(); clearMsg(); setLoading(true);
    try {
      const { error } = await supabase.from('profiles')
        .update({ full_name: editingFaculty.full_name, username: editingFaculty.username })
        .eq('id', editingFaculty.id);
      if (error) throw error;
      setSuccess('Faculty updated!'); setEditingFaculty(null); await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const deleteStudentAccount = async (id, username) => {
    if (!window.confirm(`Delete student "${username}"? This cannot be undone.`)) return;
    clearMsg();
    try { 
      const { error } = await supabase.from('profiles').delete().eq('id', id); 
      if (error) throw error; 
      // Remove from created users
      setCreatedUsers(prev => {
        const newUsers = { ...prev };
        delete newUsers[id];
        return newUsers;
      });
      setSuccess('Student deleted!'); await fetchData(); 
    }
    catch (err) { setError(err.message); }
  };

  const updateStudent = async (e) => {
    e.preventDefault(); clearMsg(); setLoading(true);
    try {
      const { error } = await supabase.from('profiles')
        .update({ full_name: editingStudent.full_name, username: editingStudent.username })
        .eq('id', editingStudent.id);
      if (error) throw error;
      setSuccess('Student updated!'); setEditingStudent(null); await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ======================== ASSIGNMENTS ========================

  const assignFacultyToClass = async (e) => {
    e.preventDefault(); clearMsg();
    if (!assignFacClassId || !assignFacId) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('class_faculty').insert({ class_id: assignFacClassId, faculty_id: assignFacId });
      if (error) throw error;
      setSuccess('Faculty assigned to class!'); setAssignFacClassId(''); setAssignFacId(''); await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const assignStudentToClass = async (e) => {
    e.preventDefault(); clearMsg();
    if (!assignStuClassId || !assignStuId) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('class_students').insert({ class_id: assignStuClassId, student_id: assignStuId });
      if (error) throw error;
      setSuccess('Student added to class!'); setAssignStuClassId(''); setAssignStuId(''); await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const unassignFaculty = async (assignmentId) => {
    if (!window.confirm('Remove this faculty from the class?')) return;
    clearMsg();
    try { const { error } = await supabase.from('class_faculty').delete().eq('id', assignmentId); if (error) throw error; setSuccess('Faculty removed from class!'); await fetchData(); }
    catch (err) { setError(err.message); }
  };

  const unassignStudent = async (assignmentId) => {
    if (!window.confirm('Remove this student from the class?')) return;
    clearMsg();
    try { const { error } = await supabase.from('class_students').delete().eq('id', assignmentId); if (error) throw error; setSuccess('Student removed from class!'); await fetchData(); }
    catch (err) { setError(err.message); }
  };

  // ======================== STUDENT SECTIONS MANAGEMENT ========================

  const fetchStudentSections = useCallback(async () => {
    if (!studentFieldClassId) { setStudentSections([]); return; }
    // Silent background refresh
    const { data: secData, error: secErr } = await supabase
      .from('student_sections').select('*').eq('class_id', studentFieldClassId).order('section_order');
    if (secErr) { setError(secErr.message); return; }
    const sectionIds = (secData || []).map((s) => s.id);
    let fieldsData = [];
    if (sectionIds.length > 0) {
      const { data: fData } = await supabase.from('student_section_fields').select('*').in('section_id', sectionIds).order('field_order');
      fieldsData = fData || [];
    }
    setStudentSections((secData || []).map((s) => ({ ...s, fields: fieldsData.filter((f) => f.section_id === s.id) })));
  }, [studentFieldClassId]);

  useEffect(() => { 
    fetchStudentSections(); 
  }, [studentFieldClassId, fetchStudentSections]);

  const saveStudentSection = async (sectionData) => {
    clearMsg(); setLoading(true);
    try {
      const { data: sec, error: secErr } = await supabase.from('student_sections').insert({
        class_id: studentFieldClassId, section_name: sectionData.section_name, section_order: studentSections.length, created_by: profile.id,
      }).select().single();
      if (secErr) throw secErr;
      for (let i = 0; i < sectionData.fields.length; i++) {
        const f = sectionData.fields[i];
        const { error: fErr } = await supabase.from('student_section_fields').insert({
          section_id: sec.id, field_name: f.field_name, field_type: f.field_type, field_options: f.field_options || [],
          field_order: i, required: f.required || false, upload_link: f.upload_link || '',
        });
        if (fErr) throw fErr;
      }
      setSuccess('Student section created!'); await fetchStudentSections();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const deleteStudentSection = async (sectionId) => {
    if (!window.confirm('Delete this section and all its fields?')) return;
    clearMsg(); setLoading(true);
    try { const { error } = await supabase.from('student_sections').delete().eq('id', sectionId); if (error) throw error; await fetchStudentSections(); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const deleteStudentSectionField = async (fieldId) => {
    clearMsg(); setLoading(true);
    try { const { error } = await supabase.from('student_section_fields').delete().eq('id', fieldId); if (error) throw error; await fetchStudentSections(); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const addStudentFieldToSection = async (sectionId, fieldData) => {
    clearMsg(); setLoading(true);
    try {
      const { error } = await supabase.from('student_section_fields').insert({
        section_id: sectionId, field_name: fieldData.field_name, field_type: fieldData.field_type,
        field_options: fieldData.field_options || [], field_order: fieldData.field_order || 0,
        required: fieldData.required || false, upload_link: fieldData.upload_link || '',
      });
      if (error) throw error;
      setSuccess('Field added!'); await fetchStudentSections();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  // ======================== FACULTY SECTIONS MANAGEMENT ========================

  const fetchFacultySections = useCallback(async () => {
    if (!facultyFieldClassId) { setFacultySections([]); return; }
    // Silent background refresh
    const { data: secData, error: secErr } = await supabase
      .from('faculty_sections').select('*').eq('class_id', facultyFieldClassId).order('section_order');
    if (secErr) { setError(secErr.message); return; }
    const sectionIds = (secData || []).map((s) => s.id);
    let fieldsData = [];
    if (sectionIds.length > 0) {
      const { data: fData } = await supabase.from('faculty_section_fields').select('*').in('section_id', sectionIds).order('field_order');
      fieldsData = fData || [];
    }
    setFacultySections((secData || []).map((s) => ({ ...s, fields: fieldsData.filter((f) => f.section_id === s.id) })));
  }, [facultyFieldClassId]);

  useEffect(() => { 
    fetchFacultySections(); 
  }, [facultyFieldClassId, fetchFacultySections]);

  const saveFacultySection = async (sectionData) => {
    clearMsg(); setLoading(true);
    try {
      const { data: sec, error: secErr } = await supabase.from('faculty_sections').insert({
        class_id: facultyFieldClassId, section_name: sectionData.section_name, section_order: facultySections.length, created_by: profile.id,
      }).select().single();
      if (secErr) throw secErr;
      for (let i = 0; i < sectionData.fields.length; i++) {
        const f = sectionData.fields[i];
        const { error: fErr } = await supabase.from('faculty_section_fields').insert({
          section_id: sec.id, field_name: f.field_name, field_type: f.field_type, field_options: f.field_options || [],
          field_order: i, required: f.required || false, upload_link: f.upload_link || '',
        });
        if (fErr) throw fErr;
      }
      setSuccess('Faculty section created!'); await fetchFacultySections();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const deleteFacultySection = async (sectionId) => {
    if (!window.confirm('Delete this section and all its fields?')) return;
    clearMsg(); setLoading(true);
    try { const { error } = await supabase.from('faculty_sections').delete().eq('id', sectionId); if (error) throw error; await fetchFacultySections(); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const deleteFacultySectionField = async (fieldId) => {
    clearMsg(); setLoading(true);
    try { const { error } = await supabase.from('faculty_section_fields').delete().eq('id', fieldId); if (error) throw error; await fetchFacultySections(); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const addFacultyFieldToSection = async (sectionId, fieldData) => {
    clearMsg(); setLoading(true);
    try {
      const { error } = await supabase.from('faculty_section_fields').insert({
        section_id: sectionId, field_name: fieldData.field_name, field_type: fieldData.field_type,
        field_options: fieldData.field_options || [], field_order: fieldData.field_order || 0,
        required: fieldData.required || false, upload_link: fieldData.upload_link || '',
      });
      if (error) throw error;
      setSuccess('Field added!'); await fetchFacultySections();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  // ======================== VIEW DATA ========================

  const fetchViewData = useCallback(async () => {
    if (!viewClassId) {
      setViewStudentData({ sections: [], students: [], submissions: {} });
      setViewFacultyData({ sections: [], faculty: [], submissions: {} });
      return;
    }

    // --- Student Data ---
    const { data: stuSecData } = await supabase.from('student_sections').select('*').eq('class_id', viewClassId).order('section_order');
    const stuSecs = stuSecData || [];
    let stuFields = [];
    if (stuSecs.length > 0) {
      const secIds = stuSecs.map((s) => s.id);
      const { data: fData } = await supabase.from('student_section_fields').select('*').in('section_id', secIds).order('field_order');
      stuFields = fData || [];
    }
    const stuSectionsWithFields = stuSecs.map((s) => ({ ...s, fields: stuFields.filter((f) => f.section_id === s.id) }));

    const { data: csData } = await supabase.from('class_students').select('student_id, profiles(id, full_name, username)').eq('class_id', viewClassId);
    const classStudents = (csData || []).map((cs) => cs.profiles).filter(Boolean);

    let stuSubmissions = {};
    if (stuFields.length > 0) {
      const fieldIds = stuFields.map((f) => f.id);
      const { data: vals } = await supabase.from('student_field_values').select('*').in('field_id', fieldIds);
      (vals || []).forEach((v) => {
        if (!stuSubmissions[v.student_id]) stuSubmissions[v.student_id] = {};
        stuSubmissions[v.student_id][v.field_id] = v.value;
      });
    }
    setViewStudentData({ sections: stuSectionsWithFields, students: classStudents, submissions: stuSubmissions });

    // --- Faculty Data ---
    const { data: facSecData } = await supabase.from('faculty_sections').select('*').eq('class_id', viewClassId).order('section_order');
    const facSecs = facSecData || [];
    let facFields = [];
    if (facSecs.length > 0) {
      const secIds = facSecs.map((s) => s.id);
      const { data: fData } = await supabase.from('faculty_section_fields').select('*').in('section_id', secIds).order('field_order');
      facFields = fData || [];
    }
    const facSectionsWithFields = facSecs.map((s) => ({ ...s, fields: facFields.filter((f) => f.section_id === s.id) }));

    const { data: cfData } = await supabase.from('class_faculty').select('faculty_id, profiles(id, full_name, username)').eq('class_id', viewClassId);
    const classFacultyList = (cfData || []).map((cf) => cf.profiles).filter(Boolean);

    let facSubmissions = {};
    if (facFields.length > 0) {
      const fieldIds = facFields.map((f) => f.id);
      const { data: vals } = await supabase.from('faculty_field_values').select('*').in('field_id', fieldIds);
      (vals || []).forEach((v) => {
        if (!facSubmissions[v.faculty_id]) facSubmissions[v.faculty_id] = {};
        facSubmissions[v.faculty_id][v.field_id] = v.value;
      });
    }
    setViewFacultyData({ sections: facSectionsWithFields, faculty: classFacultyList, submissions: facSubmissions });
  }, [viewClassId]);

  // Only fetch view data when tab changes to 'view-data' or viewClassId changes
  useEffect(() => {
    if (tab === 'view-data' && viewClassId) {
      fetchViewData();
    }
  }, [tab, viewClassId, fetchViewData]);

  // ======================== EXPORT ========================

  const exportStudentData = () => {
    const allFields = viewStudentData.sections.flatMap((s) => s.fields);
    if (allFields.length === 0 || viewStudentData.students.length === 0) return;
    const rows = viewStudentData.students.map((s) => {
      const row = { 'Full Name': s.full_name, 'Username': s.username };
      allFields.forEach((f) => { row[f.field_name] = viewStudentData.submissions[s.id]?.[f.id] || ''; });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    const cls = classes.find((c) => c.id === viewClassId);
    XLSX.utils.book_append_sheet(wb, ws, 'Student Data');
    XLSX.writeFile(wb, `student_data_${cls?.name || 'class'}.xlsx`);
  };

  const exportFacultyData = () => {
    const allFields = viewFacultyData.sections.flatMap((s) => s.fields);
    if (allFields.length === 0 || viewFacultyData.faculty.length === 0) return;
    const rows = viewFacultyData.faculty.map((f) => {
      const row = { 'Full Name': f.full_name, 'Username': f.username };
      allFields.forEach((field) => { row[field.field_name] = viewFacultyData.submissions[f.id]?.[field.id] || ''; });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    const cls = classes.find((c) => c.id === viewClassId);
    XLSX.utils.book_append_sheet(wb, ws, 'Faculty Data');
    XLSX.writeFile(wb, `faculty_data_${cls?.name || 'class'}.xlsx`);
  };

  // ======================== EXCEL IMPORT ========================

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
        const normalized = rows.map((row) => {
          const r = {};
          Object.keys(row).forEach((k) => { r[k.trim().toLowerCase()] = String(row[k]).trim(); });
          return r;
        }).filter((r) => r.username);
        if (normalized.length === 0) { setError('No valid rows found. Excel must have "username" and "password" columns.'); setImportPreview([]); return; }
        const first = normalized[0];
        if (!('password' in first) && !('pass' in first)) { setError('Excel must have a "password" (or "pass") column.'); setImportPreview([]); return; }
        setImportPreview(normalized.map((r) => ({
          username: r.username, password: r.password || r.pass || '', full_name: r.full_name || r.fullname || r.name || '',
        })));
      } catch (err) { setError('Failed to parse Excel file: ' + err.message); setImportPreview([]); }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportStudents = async () => {
    if (!importClassId || importPreview.length === 0) return;
    clearMsg(); setLoading(true);
    let created = 0, failed = 0;
    const importedUserIds = [];
    try {
      for (const stu of importPreview) {
        try {
          if (!stu.username || !stu.password) { failed++; continue; }
          const fakeEmail = usernameToEmail(stu.username);
          const { data: signUpData, error: signUpErr } = await supabaseAdmin.auth.signUp({
            email: fakeEmail, password: stu.password,
            options: { data: { full_name: stu.full_name || '', role: 'student', username: stu.username } },
          });
          if (signUpErr) { failed++; continue; }
          if (signUpData.user) {
            await supabase.from('profiles').update({ 
              role: 'student', 
              department_id: deptId, 
              full_name: stu.full_name || '', 
              username: stu.username,
              password: stu.password 
            }).eq('id', signUpData.user.id);
            await supabase.from('class_students').insert({ class_id: importClassId, student_id: signUpData.user.id });
            // Store credentials temporarily and track imported IDs
            setCreatedUsers(prev => ({ ...prev, [signUpData.user.id]: { username: stu.username, password: stu.password, type: 'student' } }));
            importedUserIds.push(signUpData.user.id);
            created++;
          }
        } catch { failed++; }
      }
      // Auto-show passwords for all imported students
      if (importedUserIds.length > 0) {
        setVisiblePasswords(prev => {
          const updated = { ...prev };
          importedUserIds.forEach(id => { updated[id] = true; });
          return updated;
        });
      }
      setSuccess(`Import complete! ${created} students created${failed > 0 ? `, ${failed} failed` : ''}.`);
      setImportPreview([]); setImportFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ======================== RENDER ========================

  const tabsList = [
    { key: 'classes', label: 'Classes' },
    { key: 'faculty', label: 'Faculty' },
    { key: 'students', label: 'Students' },
    { key: 'import', label: 'Import Students' },
    { key: 'assign', label: 'Assign' },
    { key: 'student-fields', label: 'Student Sections' },
    { key: 'faculty-fields', label: 'Faculty Sections' },
    { key: 'view-data', label: 'View Data' },
  ];

  const allViewStudentFields = viewStudentData.sections.flatMap((s) => s.fields);
  const allViewFacultyFields = viewFacultyData.sections.flatMap((s) => s.fields);

  return (
    <div className="dashboard">
      <Navbar />
      <div className="container">
        <div style={{ position: 'relative' }}>
          <h2>Super Admin Dashboard</h2>
          {dataLoading && (
            <div className="loading-indicator" title="Loading data...">
              <div className="spinner"></div>
            </div>
          )}
        </div>

        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}

        <div className="tabs">
          {tabsList.map((t) => (
            <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => { setTab(t.key); clearMsg(); }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* CLASSES TAB */}
        {tab === 'classes' && (
          <div className="card">
            <h3>Create Class</h3>
            <form onSubmit={createClass} className="form-row">
              <input type="text" placeholder="Class Name" value={className} onChange={(e) => setClassName(e.target.value)} />
              <button className="btn" type="submit" disabled={loading}>Create</button>
            </form>
            <h4>Existing Classes ({classes.length})</h4>
            {classes.length === 0 ? <p className="text-muted">No classes yet.</p> : (
              <table className="table">
                <thead><tr><th>Name</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td>
                        <button className="btn btn-sm" onClick={() => setEditingClass(c)} style={{ marginRight: '0.5rem' }}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteClass(c.id, c.name)}>Delete</button>
                      </td>
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
              <div className="form-group"><label>Full Name</label><input type="text" value={facName} onChange={(e) => setFacName(e.target.value)} placeholder="Full Name" /></div>
              <div className="form-group"><label>Username</label><input type="text" value={facUsername} onChange={(e) => setFacUsername(e.target.value)} placeholder="Username (used for login)" /></div>
              <div className="form-group"><label>Password</label><input type="password" value={facPassword} onChange={(e) => setFacPassword(e.target.value)} placeholder="Password" /></div>
              <button className="btn" type="submit" disabled={loading}>Create Faculty</button>
            </form>
            <h4>Faculty List ({faculty.length})</h4>
            {faculty.length === 0 ? <p className="text-muted">No faculty yet.</p> : (
              <table className="table">
                <thead><tr><th>Name</th><th>Username</th><th>Password</th><th>Actions</th></tr></thead>
                <tbody>
                  {faculty.map((f) => (
                    <tr key={f.id}>
                      <td>{f.full_name}</td>
                      <td>{f.username}</td>
                      <td>
                        {f.password || createdUsers[f.id] ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ color: '#059669', fontFamily: 'monospace', fontWeight: 'bold' }}>
                              {visiblePasswords[f.id] ? (f.password || createdUsers[f.id]?.password) : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(f.id)}
                              className="password-toggle-btn"
                              title={visiblePasswords[f.id] ? 'Hide password' : 'Show password'}
                            >
                              {visiblePasswords[f.id] ? '🙈' : '👁️'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted">••••••••</span>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-sm" onClick={() => setEditingFaculty(f)} style={{ marginRight: '0.5rem' }}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteFacultyAccount(f.id, f.username)}>Delete</button>
                      </td>
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
              <div className="form-group"><label>Full Name</label><input type="text" value={stuName} onChange={(e) => setStuName(e.target.value)} placeholder="Full Name" /></div>
              <div className="form-group"><label>Username</label><input type="text" value={stuUsername} onChange={(e) => setStuUsername(e.target.value)} placeholder="Username (used for login)" /></div>
              <div className="form-group"><label>Password</label><input type="password" value={stuPassword} onChange={(e) => setStuPassword(e.target.value)} placeholder="Password" /></div>
              <button className="btn" type="submit" disabled={loading}>Create Student</button>
            </form>
            <h4>Student List ({students.length})</h4>
            {students.length === 0 ? <p className="text-muted">No students yet.</p> : (
              <table className="table">
                <thead><tr><th>Name</th><th>Username</th><th>Password</th><th>Actions</th></tr></thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td>{s.full_name}</td>
                      <td>{s.username}</td>
                      <td>
                        {s.password || createdUsers[s.id] ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ color: '#059669', fontFamily: 'monospace', fontWeight: 'bold' }}>
                              {visiblePasswords[s.id] ? (s.password || createdUsers[s.id]?.password) : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(s.id)}
                              className="password-toggle-btn"
                              title={visiblePasswords[s.id] ? 'Hide password' : 'Show password'}
                            >
                              {visiblePasswords[s.id] ? '🙈' : '👁️'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted">••••••••</span>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-sm" onClick={() => setEditingStudent(s)} style={{ marginRight: '0.5rem' }}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteStudentAccount(s.id, s.username)}>Delete</button>
                      </td>
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
                        <tr key={a.id}><td>{a.profiles?.full_name}</td><td>{a.profiles?.username}</td>
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
                        <tr key={a.id}><td>{a.profiles?.full_name}</td><td>{a.profiles?.username}</td>
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
            <p className="text-muted">Upload an Excel file (.xlsx, .xls) or CSV with columns: <strong>username</strong>, <strong>password</strong>, and optionally <strong>full_name</strong>.</p>
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
                  <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />
                  {importFileName && <small className="text-muted">File: {importFileName}</small>}
                </div>
                {importPreview.length > 0 && (
                  <>
                    <h4>Preview ({importPreview.length} students)</h4>
                    <table className="table">
                      <thead><tr><th>#</th><th>Username</th><th>Password</th><th>Full Name</th></tr></thead>
                      <tbody>
                        {importPreview.map((row, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td><td>{row.username}</td>
                            <td>{row.password ? '••••••' : <span style={{color:'red'}}>Missing</span>}</td>
                            <td>{row.full_name || row.username}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button className="btn" onClick={handleImportStudents} disabled={loading}>
                      {loading ? 'Importing...' : `Import ${importPreview.length} Students`}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* STUDENT SECTIONS TAB */}
        {tab === 'student-fields' && (
          <div className="card">
            <h3>Manage Student Sections</h3>
            <p className="text-muted">Create sections with fields that students must fill out for each class.</p>
            <div className="form-group">
              <label>Select Class</label>
              <select value={studentFieldClassId} onChange={(e) => { setStudentFieldClassId(e.target.value); clearMsg(); }}>
                <option value="">-- Select Class --</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {studentFieldClassId && (
              <FormBuilder
                sections={studentSections}
                onSaveSection={saveStudentSection}
                onDeleteSection={deleteStudentSection}
                onDeleteField={deleteStudentSectionField}
                onAddField={addStudentFieldToSection}
                loading={loading}
              />
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
              <select value={facultyFieldClassId} onChange={(e) => { setFacultyFieldClassId(e.target.value); clearMsg(); }}>
                <option value="">-- Select Class --</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {facultyFieldClassId && (
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

        {/* VIEW DATA TAB */}
        {tab === 'view-data' && (
          <div className="card">
            <h3>View Collected Data</h3>
            <p className="text-muted">Select a class to view student and faculty data. You can export to Excel.</p>
            <div className="form-group">
              <label>Select Class</label>
              <select value={viewClassId} onChange={(e) => { setViewClassId(e.target.value); clearMsg(); }}>
                <option value="">-- Select Class --</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {viewClassId && (
              <>
                {/* Student Data */}
                <div style={{ marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0 }}>Student Data</h3>
                    {allViewStudentFields.length > 0 && viewStudentData.students.length > 0 && (
                      <button className="btn btn-sm" onClick={exportStudentData}>Export to Excel</button>
                    )}
                  </div>
                  {viewStudentData.students.length === 0 ? (
                    <p className="text-muted">No students in this class.</p>
                  ) : allViewStudentFields.length === 0 ? (
                    <p className="text-muted">No student sections/fields created for this class yet.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Full Name</th><th>Username</th>
                            {allViewStudentFields.map((f) => <th key={f.id}>{f.field_name}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {viewStudentData.students.map((s) => (
                            <tr key={s.id}>
                              <td>{s.full_name}</td><td>{s.username}</td>
                              {allViewStudentFields.map((f) => (
                                <td key={f.id}>{viewStudentData.submissions[s.id]?.[f.id] || '-'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Faculty Data */}
                <div style={{ marginTop: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0 }}>Faculty Data</h3>
                    {allViewFacultyFields.length > 0 && viewFacultyData.faculty.length > 0 && (
                      <button className="btn btn-sm" onClick={exportFacultyData}>Export to Excel</button>
                    )}
                  </div>
                  {viewFacultyData.faculty.length === 0 ? (
                    <p className="text-muted">No faculty assigned to this class.</p>
                  ) : allViewFacultyFields.length === 0 ? (
                    <p className="text-muted">No faculty sections/fields created for this class yet.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Full Name</th><th>Username</th>
                            {allViewFacultyFields.map((f) => <th key={f.id}>{f.field_name}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {viewFacultyData.faculty.map((f) => (
                            <tr key={f.id}>
                              <td>{f.full_name}</td><td>{f.username}</td>
                              {allViewFacultyFields.map((field) => (
                                <td key={field.id}>{viewFacultyData.submissions[f.id]?.[field.id] || '-'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Edit Class Modal */}
      {editingClass && (
        <div className="modal-overlay" onClick={() => setEditingClass(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Class</h3>
            <form onSubmit={updateClass}>
              <div className="form-group">
                <label>Class Name</label>
                <input
                  type="text"
                  value={editingClass.name}
                  onChange={(e) => setEditingClass({ ...editingClass, name: e.target.value })}
                  placeholder="Class Name"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'Updating...' : 'Update'}
                </button>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => setEditingClass(null)}
                  style={{ background: '#6b7280', color: 'white' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Faculty Modal */}
      {editingFaculty && (
        <div className="modal-overlay" onClick={() => setEditingFaculty(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Faculty</h3>
            <form onSubmit={updateFaculty}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={editingFaculty.full_name}
                  onChange={(e) => setEditingFaculty({ ...editingFaculty, full_name: e.target.value })}
                  placeholder="Full Name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={editingFaculty.username}
                  onChange={(e) => setEditingFaculty({ ...editingFaculty, username: e.target.value })}
                  placeholder="Username"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'Updating...' : 'Update'}
                </button>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => setEditingFaculty(null)}
                  style={{ background: '#6b7280', color: 'white' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="modal-overlay" onClick={() => setEditingStudent(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Student</h3>
            <form onSubmit={updateStudent}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={editingStudent.full_name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, full_name: e.target.value })}
                  placeholder="Full Name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={editingStudent.username}
                  onChange={(e) => setEditingStudent({ ...editingStudent, username: e.target.value })}
                  placeholder="Username"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'Updating...' : 'Update'}
                </button>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => setEditingStudent(null)}
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

export default SuperAdminDashboard;
