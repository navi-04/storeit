import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  AppShell, Container, Title, Card, TextInput, PasswordInput, Select,
  Button, Group, Stack, Table, Alert, Modal, Text, ActionIcon, Tabs,
  FileInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle, IconTrash, IconEdit, IconEye, IconEyeOff,
  IconUpload, IconDownload, IconCopy,
} from '@tabler/icons-react';
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
  const [error, setError] = useState('');

  const [classes, setClasses] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [students, setStudents] = useState([]);
  const [createdUsers, setCreatedUsers] = useState({});

  const [className, setClassName] = useState('');
  const [facName, setFacName] = useState('');
  const [facUsername, setFacUsername] = useState('');
  const [facPassword, setFacPassword] = useState('');
  const [stuName, setStuName] = useState('');
  const [stuUsername, setStuUsername] = useState('');
  const [stuPassword, setStuPassword] = useState('');

  const [editingClass, setEditingClass] = useState(null);
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [visiblePasswords, setVisiblePasswords] = useState({});

  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const [assignFacClassId, setAssignFacClassId] = useState('');
  const [assignFacId, setAssignFacId] = useState('');
  const [assignStuClassId, setAssignStuClassId] = useState('');
  const [assignStuId, setAssignStuId] = useState('');

  const [studentFieldClassId, setStudentFieldClassId] = useState('');
  const [studentSections, setStudentSections] = useState([]);
  const [studentCopySourceClassId, setStudentCopySourceClassId] = useState('');
  const [studentCopySectionId, setStudentCopySectionId] = useState('');
  const [studentCopySections, setStudentCopySections] = useState([]);
  const [facultyFieldClassId, setFacultyFieldClassId] = useState('');
  const [facultySections, setFacultySections] = useState([]);
  const [facultyCopySourceClassId, setFacultyCopySourceClassId] = useState('');
  const [facultyCopySectionId, setFacultyCopySectionId] = useState('');
  const [facultyCopySections, setFacultyCopySections] = useState([]);

  const [classFacultyMap, setClassFacultyMap] = useState({});
  const [classStudentMap, setClassStudentMap] = useState({});

  const [importClassId, setImportClassId] = useState('');
  const [importPreview, setImportPreview] = useState([]);
  const [importFile, setImportFile] = useState(null);

  const [viewClassId, setViewClassId] = useState('');
  const [viewStudentData, setViewStudentData] = useState({ sections: [], students: [], submissions: {} });
  const [viewFacultyData, setViewFacultyData] = useState({ sections: [], faculty: [], submissions: {} });

  const deptId = useMemo(() => profile?.department_id, [profile?.department_id]);

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

    const [cfRes, csRes] = await Promise.all([
      supabase.from('class_faculty').select('*, profiles(id, full_name, username)').order('created_at'),
      supabase.from('class_students').select('*, profiles(id, full_name, username)').order('created_at'),
    ]);
    const cfMap = {};
    (cfRes.data || []).forEach((cf) => { if (!cfMap[cf.class_id]) cfMap[cf.class_id] = []; cfMap[cf.class_id].push(cf); });
    setClassFacultyMap(cfMap);
    const csMap = {};
    (csRes.data || []).forEach((cs) => { if (!csMap[cs.class_id]) csMap[cs.class_id] = []; csMap[cs.class_id].push(cs); });
    setClassStudentMap(csMap);
  }, [deptId]);

  useEffect(() => { if (deptId) fetchData(); }, [deptId, fetchData]);

  const clearMsg = () => setError('');

  // ======================== CLASS CRUD ========================
  const createClass = async (e) => {
    e.preventDefault(); clearMsg();
    if (!className.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('classes').insert({ name: className.trim(), department_id: deptId });
      if (error) throw error;
      notifications.show({ title: 'Success', message: 'Class created!', color: 'green' });
      setClassName(''); await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const deleteClass = async (id, name) => {
    if (!window.confirm(`Delete class "${name}"?`)) return;
    clearMsg();
    try { const { error } = await supabase.from('classes').delete().eq('id', id); if (error) throw error; notifications.show({ message: 'Class deleted!', color: 'green' }); await fetchData(); }
    catch (err) { setError(err.message); }
  };

  const updateClass = async (e) => {
    e.preventDefault(); clearMsg();
    if (!editingClass?.name.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('classes').update({ name: editingClass.name.trim() }).eq('id', editingClass.id);
      if (error) throw error;
      notifications.show({ message: 'Class updated!', color: 'green' }); setEditingClass(null); await fetchData();
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
        setCreatedUsers((prev) => ({ ...prev, [data.user.id]: { username: facUsername, password: facPassword, type: 'faculty' } }));
        setVisiblePasswords((prev) => ({ ...prev, [data.user.id]: true }));
      }
      notifications.show({ message: 'Faculty created!', color: 'green' }); setFacName(''); setFacUsername(''); setFacPassword(''); await fetchData();
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
        setCreatedUsers((prev) => ({ ...prev, [data.user.id]: { username: stuUsername, password: stuPassword, type: 'student' } }));
        setVisiblePasswords((prev) => ({ ...prev, [data.user.id]: true }));
      }
      notifications.show({ message: 'Student created!', color: 'green' }); setStuName(''); setStuUsername(''); setStuPassword(''); await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const deleteFacultyAccount = async (id, username) => {
    if (!window.confirm(`Delete faculty "${username}"?`)) return; clearMsg();
    try {
      const { error } = await supabase.rpc('delete_auth_user', { target_user_id: id }); if (error) throw error;
      setCreatedUsers((prev) => { const n = { ...prev }; delete n[id]; return n; });
      notifications.show({ message: 'Faculty deleted!', color: 'green' }); await fetchData();
    } catch (err) { setError(err.message); }
  };

  const updateFaculty = async (e) => {
    e.preventDefault(); clearMsg(); setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: editingFaculty.full_name, username: editingFaculty.username }).eq('id', editingFaculty.id);
      if (error) throw error;
      notifications.show({ message: 'Faculty updated!', color: 'green' }); setEditingFaculty(null); await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const deleteStudentAccount = async (id, username) => {
    if (!window.confirm(`Delete student "${username}"?`)) return; clearMsg();
    try {
      const { error } = await supabase.rpc('delete_auth_user', { target_user_id: id }); if (error) throw error;
      setCreatedUsers((prev) => { const n = { ...prev }; delete n[id]; return n; });
      notifications.show({ message: 'Student deleted!', color: 'green' }); await fetchData();
    } catch (err) { setError(err.message); }
  };

  const updateStudent = async (e) => {
    e.preventDefault(); clearMsg(); setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: editingStudent.full_name, username: editingStudent.username }).eq('id', editingStudent.id);
      if (error) throw error;
      notifications.show({ message: 'Student updated!', color: 'green' }); setEditingStudent(null); await fetchData();
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
      notifications.show({ message: 'Faculty assigned!', color: 'green' }); setAssignFacClassId(''); setAssignFacId(''); await fetchData();
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
      notifications.show({ message: 'Student added to class!', color: 'green' }); setAssignStuClassId(''); setAssignStuId(''); await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const unassignFaculty = async (assignmentId) => {
    if (!window.confirm('Remove this faculty from the class?')) return; clearMsg();
    try { const { error } = await supabase.from('class_faculty').delete().eq('id', assignmentId); if (error) throw error; notifications.show({ message: 'Faculty removed!', color: 'green' }); await fetchData(); }
    catch (err) { setError(err.message); }
  };

  const unassignStudent = async (assignmentId) => {
    if (!window.confirm('Remove this student from the class?')) return; clearMsg();
    try { const { error } = await supabase.from('class_students').delete().eq('id', assignmentId); if (error) throw error; notifications.show({ message: 'Student removed!', color: 'green' }); await fetchData(); }
    catch (err) { setError(err.message); }
  };

  // ======================== STUDENT SECTIONS ========================
  const fetchStudentSections = useCallback(async () => {
    if (!studentFieldClassId) { setStudentSections([]); return; }
    const { data: secData, error: secErr } = await supabase.from('student_sections').select('*').eq('class_id', studentFieldClassId).order('section_order');
    if (secErr) { setError(secErr.message); return; }
    const sectionIds = (secData || []).map((s) => s.id);
    let fieldsData = [];
    if (sectionIds.length > 0) {
      const { data: fData } = await supabase.from('student_section_fields').select('*').in('section_id', sectionIds).order('field_order');
      fieldsData = fData || [];
    }
    setStudentSections((secData || []).map((s) => ({ ...s, fields: fieldsData.filter((f) => f.section_id === s.id) })));
  }, [studentFieldClassId]);

  useEffect(() => { fetchStudentSections(); }, [studentFieldClassId, fetchStudentSections]);

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
      notifications.show({ message: 'Student section created!', color: 'green' }); await fetchStudentSections();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const deleteStudentSection = async (sectionId) => {
    if (!window.confirm('Delete this section?')) return; clearMsg(); setLoading(true);
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
      notifications.show({ message: 'Field added!', color: 'green' }); await fetchStudentSections();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  // ======================== FACULTY SECTIONS ========================
  const fetchFacultySections = useCallback(async () => {
    if (!facultyFieldClassId) { setFacultySections([]); return; }
    const { data: secData, error: secErr } = await supabase.from('faculty_sections').select('*').eq('class_id', facultyFieldClassId).order('section_order');
    if (secErr) { setError(secErr.message); return; }
    const sectionIds = (secData || []).map((s) => s.id);
    let fieldsData = [];
    if (sectionIds.length > 0) {
      const { data: fData } = await supabase.from('faculty_section_fields').select('*').in('section_id', sectionIds).order('field_order');
      fieldsData = fData || [];
    }
    setFacultySections((secData || []).map((s) => ({ ...s, fields: fieldsData.filter((f) => f.section_id === s.id) })));
  }, [facultyFieldClassId]);

  useEffect(() => { fetchFacultySections(); }, [facultyFieldClassId, fetchFacultySections]);

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
      notifications.show({ message: 'Faculty section created!', color: 'green' }); await fetchFacultySections();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const deleteFacultySection = async (sectionId) => {
    if (!window.confirm('Delete this section?')) return; clearMsg(); setLoading(true);
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
      notifications.show({ message: 'Field added!', color: 'green' }); await fetchFacultySections();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const fetchSectionsWithFields = useCallback(async (classId, sectionTable, fieldTable) => {
    if (!classId) return [];

    const { data: secData, error: secErr } = await supabase
      .from(sectionTable)
      .select('*')
      .eq('class_id', classId)
      .order('section_order');
    if (secErr) throw secErr;

    const sectionIds = (secData || []).map((s) => s.id);
    let fieldsData = [];
    if (sectionIds.length > 0) {
      const { data: fData, error: fErr } = await supabase
        .from(fieldTable)
        .select('*')
        .in('section_id', sectionIds)
        .order('field_order');
      if (fErr) throw fErr;
      fieldsData = fData || [];
    }

    return (secData || []).map((s) => ({
      ...s,
      fields: fieldsData.filter((f) => f.section_id === s.id),
    }));
  }, []);

  useEffect(() => {
    const loadStudentCopySections = async () => {
      if (!studentCopySourceClassId) {
        setStudentCopySections([]);
        setStudentCopySectionId('');
        return;
      }

      try {
        const sections = await fetchSectionsWithFields(
          studentCopySourceClassId,
          'student_sections',
          'student_section_fields'
        );
        setStudentCopySections(sections);
        setStudentCopySectionId((prev) => (sections.some((s) => s.id === prev) ? prev : ''));
      } catch (err) {
        setError(err.message);
        setStudentCopySections([]);
      }
    };

    loadStudentCopySections();
  }, [studentCopySourceClassId, fetchSectionsWithFields]);

  useEffect(() => {
    const loadFacultyCopySections = async () => {
      if (!facultyCopySourceClassId) {
        setFacultyCopySections([]);
        setFacultyCopySectionId('');
        return;
      }

      try {
        const sections = await fetchSectionsWithFields(
          facultyCopySourceClassId,
          'faculty_sections',
          'faculty_section_fields'
        );
        setFacultyCopySections(sections);
        setFacultyCopySectionId((prev) => (sections.some((s) => s.id === prev) ? prev : ''));
      } catch (err) {
        setError(err.message);
        setFacultyCopySections([]);
      }
    };

    loadFacultyCopySections();
  }, [facultyCopySourceClassId, fetchSectionsWithFields]);

  const copySectionsAcrossClasses = async ({
    sourceClassId,
    targetClassId,
    sourceSectionId,
    sectionTable,
    fieldTable,
    copyAll,
    label,
  }) => {
    if (!sourceClassId || !targetClassId) return false;
    if (!profile?.id) {
      setError('Could not identify current admin user. Please refresh and try again.');
      return false;
    }
    if (sourceClassId === targetClassId) {
      setError('Source class and target class must be different.');
      return false;
    }

    clearMsg();
    setLoading(true);

    try {
      const sourceSections = await fetchSectionsWithFields(sourceClassId, sectionTable, fieldTable);
      const sectionsToCopy = copyAll
        ? sourceSections
        : sourceSections.filter((s) => s.id === sourceSectionId);

      if (sectionsToCopy.length === 0) {
        notifications.show({ message: `No ${label.toLowerCase()} sections found to copy.`, color: 'yellow' });
        return false;
      }

      const { count, error: countErr } = await supabase
        .from(sectionTable)
        .select('id', { count: 'exact', head: true })
        .eq('class_id', targetClassId);
      if (countErr) throw countErr;

      const startOrder = count || 0;
      let copiedCount = 0;

      for (let i = 0; i < sectionsToCopy.length; i++) {
        const sourceSection = sectionsToCopy[i];
        const { data: insertedSection, error: secInsertErr } = await supabase
          .from(sectionTable)
          .insert({
            class_id: targetClassId,
            section_name: sourceSection.section_name,
            section_order: startOrder + i,
            created_by: profile.id,
          })
          .select()
          .single();
        if (secInsertErr) throw secInsertErr;

        const sectionFields = [...(sourceSection.fields || [])].sort((a, b) => (a.field_order || 0) - (b.field_order || 0));
        if (sectionFields.length > 0) {
          const payload = sectionFields.map((f, idx) => ({
            section_id: insertedSection.id,
            field_name: f.field_name,
            field_type: f.field_type,
            field_options: f.field_options || [],
            field_order: idx,
            required: f.required || false,
            upload_link: f.upload_link || '',
          }));

          const { error: fieldInsertErr } = await supabase.from(fieldTable).insert(payload);
          if (fieldInsertErr) throw fieldInsertErr;
        }

        copiedCount += 1;
      }

      notifications.show({
        message: `Copied ${copiedCount} ${label.toLowerCase()} section${copiedCount > 1 ? 's' : ''}.`,
        color: 'green',
      });
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const copyStudentSectionFromClass = async () => {
    if (!studentFieldClassId || !studentCopySourceClassId || !studentCopySectionId) return;
    const copied = await copySectionsAcrossClasses({
      sourceClassId: studentCopySourceClassId,
      targetClassId: studentFieldClassId,
      sourceSectionId: studentCopySectionId,
      sectionTable: 'student_sections',
      fieldTable: 'student_section_fields',
      copyAll: false,
      label: 'Student',
    });
    if (copied) await fetchStudentSections();
  };

  const copyStudentFormFromClass = async () => {
    if (!studentFieldClassId || !studentCopySourceClassId) return;
    const copied = await copySectionsAcrossClasses({
      sourceClassId: studentCopySourceClassId,
      targetClassId: studentFieldClassId,
      sectionTable: 'student_sections',
      fieldTable: 'student_section_fields',
      copyAll: true,
      label: 'Student',
    });
    if (copied) await fetchStudentSections();
  };

  const copyFacultySectionFromClass = async () => {
    if (!facultyFieldClassId || !facultyCopySourceClassId || !facultyCopySectionId) return;
    const copied = await copySectionsAcrossClasses({
      sourceClassId: facultyCopySourceClassId,
      targetClassId: facultyFieldClassId,
      sourceSectionId: facultyCopySectionId,
      sectionTable: 'faculty_sections',
      fieldTable: 'faculty_section_fields',
      copyAll: false,
      label: 'Faculty',
    });
    if (copied) await fetchFacultySections();
  };

  const copyFacultyFormFromClass = async () => {
    if (!facultyFieldClassId || !facultyCopySourceClassId) return;
    const copied = await copySectionsAcrossClasses({
      sourceClassId: facultyCopySourceClassId,
      targetClassId: facultyFieldClassId,
      sectionTable: 'faculty_sections',
      fieldTable: 'faculty_section_fields',
      copyAll: true,
      label: 'Faculty',
    });
    if (copied) await fetchFacultySections();
  };

  // ======================== VIEW DATA ========================
  const fetchViewData = useCallback(async () => {
    if (!viewClassId) {
      setViewStudentData({ sections: [], students: [], submissions: {} });
      setViewFacultyData({ sections: [], faculty: [], submissions: {} });
      return;
    }

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
      (vals || []).forEach((v) => { if (!stuSubmissions[v.student_id]) stuSubmissions[v.student_id] = {}; stuSubmissions[v.student_id][v.field_id] = v.value; });
    }
    setViewStudentData({ sections: stuSectionsWithFields, students: classStudents, submissions: stuSubmissions });

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
      (vals || []).forEach((v) => { if (!facSubmissions[v.faculty_id]) facSubmissions[v.faculty_id] = {}; facSubmissions[v.faculty_id][v.field_id] = v.value; });
    }
    setViewFacultyData({ sections: facSectionsWithFields, faculty: classFacultyList, submissions: facSubmissions });
  }, [viewClassId]);

  useEffect(() => { if (tab === 'view-data' && viewClassId) fetchViewData(); }, [tab, viewClassId, fetchViewData]);

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

  // ======================== IMPORT ========================
  const handleFileSelect = (file) => {
    if (!file) { setImportPreview([]); setImportFile(null); return; }
    setImportFile(file);
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
        if (normalized.length === 0) { setError('No valid rows. Excel must have "username" and "password" columns.'); setImportPreview([]); return; }
        const first = normalized[0];
        if (!('password' in first) && !('pass' in first)) { setError('Excel must have a "password" column.'); setImportPreview([]); return; }
        setImportPreview(normalized.map((r) => ({
          username: r.username, password: r.password || r.pass || '', full_name: r.full_name || r.fullname || r.name || '',
        })));
      } catch (err) { setError('Failed to parse file: ' + err.message); setImportPreview([]); }
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
            await supabase.from('profiles').update({ role: 'student', department_id: deptId, full_name: stu.full_name || '', username: stu.username, password: stu.password }).eq('id', signUpData.user.id);
            await supabase.from('class_students').insert({ class_id: importClassId, student_id: signUpData.user.id });
            setCreatedUsers((prev) => ({ ...prev, [signUpData.user.id]: { username: stu.username, password: stu.password, type: 'student' } }));
            importedUserIds.push(signUpData.user.id);
            created++;
          }
        } catch { failed++; }
      }
      if (importedUserIds.length > 0) {
        setVisiblePasswords((prev) => {
          const updated = { ...prev };
          importedUserIds.forEach((id) => { updated[id] = true; });
          return updated;
        });
      }
      notifications.show({ message: `Import done! ${created} created${failed > 0 ? `, ${failed} failed` : ''}.`, color: 'green' });
      setImportPreview([]); setImportFile(null);
      await fetchData();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const classSelectData = classes.map((c) => ({ value: c.id, label: c.name }));
  const studentCopyClassOptions = classes
    .filter((c) => c.id !== studentFieldClassId)
    .map((c) => ({ value: c.id, label: c.name }));
  const studentCopySectionOptions = studentCopySections
    .map((s) => ({ value: s.id, label: `${s.section_name} (${(s.fields || []).length} fields)` }));
  const facultyCopyClassOptions = classes
    .filter((c) => c.id !== facultyFieldClassId)
    .map((c) => ({ value: c.id, label: c.name }));
  const facultyCopySectionOptions = facultyCopySections
    .map((s) => ({ value: s.id, label: `${s.section_name} (${(s.fields || []).length} fields)` }));
  const allViewStudentFields = viewStudentData.sections.flatMap((s) => s.fields);
  const allViewFacultyFields = viewFacultyData.sections.flatMap((s) => s.fields);

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header bg="indigo.6"><Navbar /></AppShell.Header>
      <AppShell.Main>
        <Container size="lg" py="lg">
          <Title order={2} mb="lg">Super Admin Dashboard</Title>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md" withCloseButton onClose={clearMsg}>
              {error}
            </Alert>
          )}

          <Tabs value={tab} onChange={setTab} mb="lg">
            <Tabs.List>
              <Tabs.Tab value="classes">Classes</Tabs.Tab>
              <Tabs.Tab value="faculty">Faculty</Tabs.Tab>
              <Tabs.Tab value="students">Students</Tabs.Tab>
              <Tabs.Tab value="import">Import</Tabs.Tab>
              <Tabs.Tab value="assign">Assign</Tabs.Tab>
              <Tabs.Tab value="student-fields">Student Sections</Tabs.Tab>
              <Tabs.Tab value="faculty-fields">Faculty Sections</Tabs.Tab>
              <Tabs.Tab value="view-data">View Data</Tabs.Tab>
            </Tabs.List>

            {/* CLASSES TAB */}
            <Tabs.Panel value="classes" pt="md">
              <Card withBorder padding="lg">
                <Title order={4} mb="sm">Create Class</Title>
                <form onSubmit={createClass}>
                  <Group><TextInput placeholder="Class Name" value={className} onChange={(e) => setClassName(e.currentTarget.value)} style={{ flex: 1 }} /><Button type="submit" loading={loading}>Create</Button></Group>
                </form>
                <Title order={5} mt="lg" mb="xs">Existing Classes ({classes.length})</Title>
                {classes.length === 0 ? <Text c="dimmed">No classes yet.</Text> : (
                  <Table striped highlightOnHover>
                    <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Created</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead>
                    <Table.Tbody>
                      {classes.map((c) => (
                        <Table.Tr key={c.id}>
                          <Table.Td>{c.name}</Table.Td>
                          <Table.Td>{new Date(c.created_at).toLocaleDateString()}</Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <ActionIcon variant="light" color="indigo" onClick={() => setEditingClass(c)}><IconEdit size={16} /></ActionIcon>
                              <ActionIcon variant="light" color="red" onClick={() => deleteClass(c.id, c.name)}><IconTrash size={16} /></ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Card>
            </Tabs.Panel>

            {/* FACULTY TAB */}
            <Tabs.Panel value="faculty" pt="md">
              <Card withBorder padding="lg">
                <Title order={4} mb="sm">Create Faculty Account</Title>
                <form onSubmit={createFaculty}>
                  <Stack gap="sm">
                    <TextInput label="Full Name" value={facName} onChange={(e) => setFacName(e.currentTarget.value)} placeholder="Full Name" />
                    <TextInput label="Username" value={facUsername} onChange={(e) => setFacUsername(e.currentTarget.value)} placeholder="Username" />
                    <PasswordInput label="Password" value={facPassword} onChange={(e) => setFacPassword(e.currentTarget.value)} placeholder="Password" />
                    <Button type="submit" loading={loading}>Create Faculty</Button>
                  </Stack>
                </form>
                <Title order={5} mt="lg" mb="xs">Faculty List ({faculty.length})</Title>
                {faculty.length === 0 ? <Text c="dimmed">No faculty yet.</Text> : (
                  <Table striped highlightOnHover>
                    <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Username</Table.Th><Table.Th>Password</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead>
                    <Table.Tbody>
                      {faculty.map((f) => (
                        <Table.Tr key={f.id}>
                          <Table.Td>{f.full_name}</Table.Td>
                          <Table.Td>{f.username}</Table.Td>
                          <Table.Td>
                            {f.password || createdUsers[f.id] ? (
                              <Group gap="xs">
                                <Text size="sm" ff="monospace" c="teal" fw={600}>{visiblePasswords[f.id] ? (f.password || createdUsers[f.id]?.password) : '••••••••'}</Text>
                                <ActionIcon variant="subtle" size="sm" onClick={() => togglePasswordVisibility(f.id)}>{visiblePasswords[f.id] ? <IconEyeOff size={14} /> : <IconEye size={14} />}</ActionIcon>
                              </Group>
                            ) : <Text c="dimmed" size="sm">••••••••</Text>}
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <ActionIcon variant="light" color="indigo" onClick={() => setEditingFaculty(f)}><IconEdit size={16} /></ActionIcon>
                              <ActionIcon variant="light" color="red" onClick={() => deleteFacultyAccount(f.id, f.username)}><IconTrash size={16} /></ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Card>
            </Tabs.Panel>

            {/* STUDENTS TAB */}
            <Tabs.Panel value="students" pt="md">
              <Card withBorder padding="lg">
                <Title order={4} mb="sm">Create Student Account</Title>
                <form onSubmit={createStudent}>
                  <Stack gap="sm">
                    <TextInput label="Full Name" value={stuName} onChange={(e) => setStuName(e.currentTarget.value)} placeholder="Full Name" />
                    <TextInput label="Username" value={stuUsername} onChange={(e) => setStuUsername(e.currentTarget.value)} placeholder="Username" />
                    <PasswordInput label="Password" value={stuPassword} onChange={(e) => setStuPassword(e.currentTarget.value)} placeholder="Password" />
                    <Button type="submit" loading={loading}>Create Student</Button>
                  </Stack>
                </form>
                <Title order={5} mt="lg" mb="xs">Student List ({students.length})</Title>
                {students.length === 0 ? <Text c="dimmed">No students yet.</Text> : (
                  <Table striped highlightOnHover>
                    <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Username</Table.Th><Table.Th>Password</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead>
                    <Table.Tbody>
                      {students.map((s) => (
                        <Table.Tr key={s.id}>
                          <Table.Td>{s.full_name}</Table.Td>
                          <Table.Td>{s.username}</Table.Td>
                          <Table.Td>
                            {s.password || createdUsers[s.id] ? (
                              <Group gap="xs">
                                <Text size="sm" ff="monospace" c="teal" fw={600}>{visiblePasswords[s.id] ? (s.password || createdUsers[s.id]?.password) : '••••••••'}</Text>
                                <ActionIcon variant="subtle" size="sm" onClick={() => togglePasswordVisibility(s.id)}>{visiblePasswords[s.id] ? <IconEyeOff size={14} /> : <IconEye size={14} />}</ActionIcon>
                              </Group>
                            ) : <Text c="dimmed" size="sm">••••••••</Text>}
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <ActionIcon variant="light" color="indigo" onClick={() => setEditingStudent(s)}><IconEdit size={16} /></ActionIcon>
                              <ActionIcon variant="light" color="red" onClick={() => deleteStudentAccount(s.id, s.username)}><IconTrash size={16} /></ActionIcon>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}
              </Card>
            </Tabs.Panel>

            {/* ASSIGN TAB */}
            <Tabs.Panel value="assign" pt="md">
              <Card withBorder padding="lg">
                <Title order={4} mb="sm">Assign Faculty to Class</Title>
                <form onSubmit={assignFacultyToClass}>
                  <Group grow mb="sm">
                    <Select placeholder="-- Select Class --" data={classSelectData} value={assignFacClassId || null} onChange={(v) => setAssignFacClassId(v || '')} />
                    <Select placeholder="-- Select Faculty --" data={faculty.map((f) => ({ value: f.id, label: `${f.full_name} (${f.username})` }))} value={assignFacId || null} onChange={(v) => setAssignFacId(v || '')} />
                    <Button type="submit" loading={loading}>Assign</Button>
                  </Group>
                </form>
                {classes.map((c) => {
                  const assigned = classFacultyMap[c.id] || [];
                  if (assigned.length === 0) return null;
                  return (
                    <Card key={c.id} withBorder mt="sm" padding="sm">
                      <Title order={6} mb="xs">{c.name} — Faculty</Title>
                      <Table>
                        <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Username</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead>
                        <Table.Tbody>
                          {assigned.map((a) => (
                            <Table.Tr key={a.id}><Table.Td>{a.profiles?.full_name}</Table.Td><Table.Td>{a.profiles?.username}</Table.Td>
                              <Table.Td><ActionIcon variant="light" color="red" onClick={() => unassignFaculty(a.id)}><IconTrash size={14} /></ActionIcon></Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Card>
                  );
                })}

                <Title order={4} mt="xl" mb="sm">Add Student to Class</Title>
                <form onSubmit={assignStudentToClass}>
                  <Group grow mb="sm">
                    <Select placeholder="-- Select Class --" data={classSelectData} value={assignStuClassId || null} onChange={(v) => setAssignStuClassId(v || '')} />
                    <Select placeholder="-- Select Student --" data={students.map((s) => ({ value: s.id, label: `${s.full_name} (${s.username})` }))} value={assignStuId || null} onChange={(v) => setAssignStuId(v || '')} />
                    <Button type="submit" loading={loading}>Add to Class</Button>
                  </Group>
                </form>
                {classes.map((c) => {
                  const assigned = classStudentMap[c.id] || [];
                  if (assigned.length === 0) return null;
                  return (
                    <Card key={c.id} withBorder mt="sm" padding="sm">
                      <Title order={6} mb="xs">{c.name} — Students</Title>
                      <Table>
                        <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Username</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead>
                        <Table.Tbody>
                          {assigned.map((a) => (
                            <Table.Tr key={a.id}><Table.Td>{a.profiles?.full_name}</Table.Td><Table.Td>{a.profiles?.username}</Table.Td>
                              <Table.Td><ActionIcon variant="light" color="red" onClick={() => unassignStudent(a.id)}><IconTrash size={14} /></ActionIcon></Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Card>
                  );
                })}
              </Card>
            </Tabs.Panel>

            {/* IMPORT TAB */}
            <Tabs.Panel value="import" pt="md">
              <Card withBorder padding="lg">
                <Title order={4} mb="sm">Import Students from Excel</Title>
                <Text c="dimmed" size="sm" mb="md">Upload an Excel file with columns: <b>username</b>, <b>password</b>, and optionally <b>full_name</b>.</Text>
                <Select label="Select Class" placeholder="-- Select Class --" data={classSelectData} value={importClassId || null} onChange={(v) => { setImportClassId(v || ''); setImportPreview([]); setImportFile(null); }} mb="sm" />
                {importClassId && (
                  <>
                    <FileInput
                      label="Choose File"
                      placeholder="Select .xlsx, .xls, or .csv"
                      accept=".xlsx,.xls,.csv"
                      value={importFile}
                      onChange={handleFileSelect}
                      leftSection={<IconUpload size={16} />}
                      mb="sm"
                    />
                    {importPreview.length > 0 && (
                      <>
                        <Title order={5} mb="xs">Preview ({importPreview.length} students)</Title>
                        <Table striped mb="sm">
                          <Table.Thead><Table.Tr><Table.Th>#</Table.Th><Table.Th>Username</Table.Th><Table.Th>Password</Table.Th><Table.Th>Full Name</Table.Th></Table.Tr></Table.Thead>
                          <Table.Tbody>
                            {importPreview.map((row, i) => (
                              <Table.Tr key={i}>
                                <Table.Td>{i + 1}</Table.Td>
                                <Table.Td>{row.username}</Table.Td>
                                <Table.Td>{row.password ? '••••••' : <Text c="red" size="sm">Missing</Text>}</Table.Td>
                                <Table.Td>{row.full_name || row.username}</Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                        <Button onClick={handleImportStudents} loading={loading} leftSection={<IconUpload size={16} />}>
                          Import {importPreview.length} Students
                        </Button>
                      </>
                    )}
                  </>
                )}
              </Card>
            </Tabs.Panel>

            {/* STUDENT SECTIONS TAB */}
            <Tabs.Panel value="student-fields" pt="md">
              <Card withBorder padding="lg">
                <Title order={4} mb="sm">Manage Student Sections</Title>
                <Text c="dimmed" size="sm" mb="md">Create sections with fields that students must fill out.</Text>
                <Select
                  label="Select Class"
                  placeholder="-- Select Class --"
                  data={classSelectData}
                  value={studentFieldClassId || null}
                  onChange={(v) => {
                    const nextClassId = v || '';
                    setStudentFieldClassId(nextClassId);
                    if (studentCopySourceClassId === nextClassId) {
                      setStudentCopySourceClassId('');
                      setStudentCopySectionId('');
                      setStudentCopySections([]);
                    }
                    clearMsg();
                  }}
                  mb="md"
                />
                {studentFieldClassId && (
                  <>
                    <Card withBorder padding="md" mb="md" bg="gray.0">
                      <Title order={6} mb="xs">Copy Student Form Setup</Title>
                      <Text c="dimmed" size="sm" mb="sm">
                        Copy one section or the full student form from another class.
                      </Text>
                      <Group grow align="end">
                        <Select
                          label="Source Class"
                          placeholder="-- Select Source Class --"
                          data={studentCopyClassOptions}
                          value={studentCopySourceClassId || null}
                          onChange={(v) => {
                            setStudentCopySourceClassId(v || '');
                            setStudentCopySectionId('');
                            clearMsg();
                          }}
                          disabled={studentCopyClassOptions.length === 0}
                        />
                        <Select
                          label="Source Section"
                          placeholder="-- Select Section --"
                          data={studentCopySectionOptions}
                          value={studentCopySectionId || null}
                          onChange={(v) => setStudentCopySectionId(v || '')}
                          disabled={!studentCopySourceClassId || studentCopySectionOptions.length === 0}
                        />
                      </Group>
                      <Group mt="sm">
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconCopy size={14} />}
                          onClick={copyStudentSectionFromClass}
                          disabled={loading || !studentCopySourceClassId || !studentCopySectionId}
                        >
                          Copy Selected Section
                        </Button>
                        <Button
                          size="xs"
                          leftSection={<IconCopy size={14} />}
                          onClick={copyStudentFormFromClass}
                          disabled={loading || !studentCopySourceClassId}
                        >
                          Copy Full Form
                        </Button>
                      </Group>
                      {studentCopyClassOptions.length === 0 && (
                        <Text c="dimmed" size="xs" mt="sm">Create at least one more class to use copy options.</Text>
                      )}
                    </Card>

                    <FormBuilder sections={studentSections} onSaveSection={saveStudentSection} onDeleteSection={deleteStudentSection} onDeleteField={deleteStudentSectionField} onAddField={addStudentFieldToSection} loading={loading} />
                  </>
                )}
              </Card>
            </Tabs.Panel>

            {/* FACULTY SECTIONS TAB */}
            <Tabs.Panel value="faculty-fields" pt="md">
              <Card withBorder padding="lg">
                <Title order={4} mb="sm">Manage Faculty Sections</Title>
                <Text c="dimmed" size="sm" mb="md">Create sections with fields that faculty must fill out.</Text>
                <Select
                  label="Select Class"
                  placeholder="-- Select Class --"
                  data={classSelectData}
                  value={facultyFieldClassId || null}
                  onChange={(v) => {
                    const nextClassId = v || '';
                    setFacultyFieldClassId(nextClassId);
                    if (facultyCopySourceClassId === nextClassId) {
                      setFacultyCopySourceClassId('');
                      setFacultyCopySectionId('');
                      setFacultyCopySections([]);
                    }
                    clearMsg();
                  }}
                  mb="md"
                />
                {facultyFieldClassId && (
                  <>
                    <Card withBorder padding="md" mb="md" bg="gray.0">
                      <Title order={6} mb="xs">Copy Faculty Form Setup</Title>
                      <Text c="dimmed" size="sm" mb="sm">
                        Copy one section or the full faculty form from another class.
                      </Text>
                      <Group grow align="end">
                        <Select
                          label="Source Class"
                          placeholder="-- Select Source Class --"
                          data={facultyCopyClassOptions}
                          value={facultyCopySourceClassId || null}
                          onChange={(v) => {
                            setFacultyCopySourceClassId(v || '');
                            setFacultyCopySectionId('');
                            clearMsg();
                          }}
                          disabled={facultyCopyClassOptions.length === 0}
                        />
                        <Select
                          label="Source Section"
                          placeholder="-- Select Section --"
                          data={facultyCopySectionOptions}
                          value={facultyCopySectionId || null}
                          onChange={(v) => setFacultyCopySectionId(v || '')}
                          disabled={!facultyCopySourceClassId || facultyCopySectionOptions.length === 0}
                        />
                      </Group>
                      <Group mt="sm">
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconCopy size={14} />}
                          onClick={copyFacultySectionFromClass}
                          disabled={loading || !facultyCopySourceClassId || !facultyCopySectionId}
                        >
                          Copy Selected Section
                        </Button>
                        <Button
                          size="xs"
                          leftSection={<IconCopy size={14} />}
                          onClick={copyFacultyFormFromClass}
                          disabled={loading || !facultyCopySourceClassId}
                        >
                          Copy Full Form
                        </Button>
                      </Group>
                      {facultyCopyClassOptions.length === 0 && (
                        <Text c="dimmed" size="xs" mt="sm">Create at least one more class to use copy options.</Text>
                      )}
                    </Card>

                    <FormBuilder sections={facultySections} onSaveSection={saveFacultySection} onDeleteSection={deleteFacultySection} onDeleteField={deleteFacultySectionField} onAddField={addFacultyFieldToSection} loading={loading} />
                  </>
                )}
              </Card>
            </Tabs.Panel>

            {/* VIEW DATA TAB */}
            <Tabs.Panel value="view-data" pt="md">
              <Card withBorder padding="lg">
                <Title order={4} mb="sm">View Collected Data</Title>
                <Text c="dimmed" size="sm" mb="md">Select a class to view data. Export to Excel.</Text>
                <Select label="Select Class" placeholder="-- Select Class --" data={classSelectData} value={viewClassId || null} onChange={(v) => { setViewClassId(v || ''); clearMsg(); }} mb="md" />

                {viewClassId && (
                  <>
                    <Group justify="space-between" mb="sm" mt="lg">
                      <Title order={5}>Student Data</Title>
                      {allViewStudentFields.length > 0 && viewStudentData.students.length > 0 && (
                        <Button size="xs" variant="light" onClick={exportStudentData} leftSection={<IconDownload size={14} />}>Export</Button>
                      )}
                    </Group>
                    {viewStudentData.students.length === 0 ? <Text c="dimmed">No students in this class.</Text> :
                      allViewStudentFields.length === 0 ? <Text c="dimmed">No student fields yet.</Text> : (
                        <Table striped highlightOnHover>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Full Name</Table.Th><Table.Th>Username</Table.Th>
                              {allViewStudentFields.map((f) => <Table.Th key={f.id}>{f.field_name}</Table.Th>)}
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {viewStudentData.students.map((s) => (
                              <Table.Tr key={s.id}>
                                <Table.Td>{s.full_name}</Table.Td><Table.Td>{s.username}</Table.Td>
                                {allViewStudentFields.map((f) => <Table.Td key={f.id}>{viewStudentData.submissions[s.id]?.[f.id] || '-'}</Table.Td>)}
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      )}

                    <Group justify="space-between" mb="sm" mt="xl">
                      <Title order={5}>Faculty Data</Title>
                      {allViewFacultyFields.length > 0 && viewFacultyData.faculty.length > 0 && (
                        <Button size="xs" variant="light" onClick={exportFacultyData} leftSection={<IconDownload size={14} />}>Export</Button>
                      )}
                    </Group>
                    {viewFacultyData.faculty.length === 0 ? <Text c="dimmed">No faculty in this class.</Text> :
                      allViewFacultyFields.length === 0 ? <Text c="dimmed">No faculty fields yet.</Text> : (
                        <Table striped highlightOnHover>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Full Name</Table.Th><Table.Th>Username</Table.Th>
                              {allViewFacultyFields.map((f) => <Table.Th key={f.id}>{f.field_name}</Table.Th>)}
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {viewFacultyData.faculty.map((f) => (
                              <Table.Tr key={f.id}>
                                <Table.Td>{f.full_name}</Table.Td><Table.Td>{f.username}</Table.Td>
                                {allViewFacultyFields.map((field) => <Table.Td key={field.id}>{viewFacultyData.submissions[f.id]?.[field.id] || '-'}</Table.Td>)}
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      )}
                  </>
                )}
              </Card>
            </Tabs.Panel>
          </Tabs>
        </Container>
      </AppShell.Main>

      {/* Edit Class Modal */}
      <Modal opened={!!editingClass} onClose={() => setEditingClass(null)} title="Edit Class">
        <form onSubmit={updateClass}>
          <Stack gap="sm">
            <TextInput label="Class Name" value={editingClass?.name || ''} onChange={(e) => setEditingClass({ ...editingClass, name: e.currentTarget.value })} required />
            <Group><Button type="submit" loading={loading}>Update</Button><Button variant="light" color="gray" onClick={() => setEditingClass(null)}>Cancel</Button></Group>
          </Stack>
        </form>
      </Modal>

      {/* Edit Faculty Modal */}
      <Modal opened={!!editingFaculty} onClose={() => setEditingFaculty(null)} title="Edit Faculty">
        <form onSubmit={updateFaculty}>
          <Stack gap="sm">
            <TextInput label="Full Name" value={editingFaculty?.full_name || ''} onChange={(e) => setEditingFaculty({ ...editingFaculty, full_name: e.currentTarget.value })} required />
            <TextInput label="Username" value={editingFaculty?.username || ''} onChange={(e) => setEditingFaculty({ ...editingFaculty, username: e.currentTarget.value })} required />
            <Group><Button type="submit" loading={loading}>Update</Button><Button variant="light" color="gray" onClick={() => setEditingFaculty(null)}>Cancel</Button></Group>
          </Stack>
        </form>
      </Modal>

      {/* Edit Student Modal */}
      <Modal opened={!!editingStudent} onClose={() => setEditingStudent(null)} title="Edit Student">
        <form onSubmit={updateStudent}>
          <Stack gap="sm">
            <TextInput label="Full Name" value={editingStudent?.full_name || ''} onChange={(e) => setEditingStudent({ ...editingStudent, full_name: e.currentTarget.value })} required />
            <TextInput label="Username" value={editingStudent?.username || ''} onChange={(e) => setEditingStudent({ ...editingStudent, username: e.currentTarget.value })} required />
            <Group><Button type="submit" loading={loading}>Update</Button><Button variant="light" color="gray" onClick={() => setEditingStudent(null)}>Cancel</Button></Group>
          </Stack>
        </form>
      </Modal>
    </AppShell>
  );
}

export default SuperAdminDashboard;
