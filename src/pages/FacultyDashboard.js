import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import FieldRenderer from '../components/FieldRenderer';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('faculty-fields');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [assignedClasses, setAssignedClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  // Student sections (created by super admin, faculty views student data)
  const [studentSections, setStudentSections] = useState([]);
  // Faculty sections (created by super admin, faculty fills values)
  const [facultySections, setFacultySections] = useState([]);
  const [facultyFieldValues, setFacultyFieldValues] = useState({});

  // Student submissions view
  const [classStudents, setClassStudents] = useState([]);
  const [studentSubmissions, setStudentSubmissions] = useState({});

  const fetchAssignedClasses = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('class_faculty')
      .select('class_id, classes(id, name)')
      .eq('faculty_id', user.id);
    if (error) { setError(error.message); return; }
    const cls = (data || []).map((cf) => cf.classes).filter(Boolean);
    setAssignedClasses(cls);
    if (cls.length > 0 && !selectedClassId) {
      setSelectedClassId(cls[0].id);
    }
  }, [user, selectedClassId]);

  // ──── STUDENT SECTIONS (read-only, created by super admin) ────
  const fetchStudentSections = useCallback(async () => {
    if (!selectedClassId) return;
    const { data: secData, error: secErr } = await supabase
      .from('student_sections')
      .select('*')
      .eq('class_id', selectedClassId)
      .order('section_order');
    if (secErr) { setError(secErr.message); return; }
    const sections = secData || [];
    if (sections.length === 0) { setStudentSections([]); return; }

    const sectionIds = sections.map((s) => s.id);
    const { data: fieldData } = await supabase
      .from('student_section_fields')
      .select('*')
      .in('section_id', sectionIds)
      .order('field_order');

    setStudentSections(sections.map((sec) => ({
      ...sec,
      fields: (fieldData || []).filter((f) => f.section_id === sec.id),
    })));
  }, [selectedClassId]);

  // ──── FACULTY SECTIONS (super admin creates, faculty fills values) ────
  const fetchFacultySections = useCallback(async () => {
    if (!selectedClassId || !user) return;
    const { data: secData, error: secErr } = await supabase
      .from('faculty_sections')
      .select('*')
      .eq('class_id', selectedClassId)
      .order('section_order');
    if (secErr) { setError(secErr.message); return; }
    const sections = secData || [];
    if (sections.length === 0) { setFacultySections([]); setFacultyFieldValues({}); return; }

    const sectionIds = sections.map((s) => s.id);
    const { data: fieldData } = await supabase
      .from('faculty_section_fields')
      .select('*')
      .in('section_id', sectionIds)
      .order('field_order');

    const result = sections.map((sec) => ({
      ...sec,
      fields: (fieldData || []).filter((f) => f.section_id === sec.id),
    }));
    setFacultySections(result);

    // Fetch faculty's own values
    const allFieldIds = (fieldData || []).map((f) => f.id);
    if (allFieldIds.length > 0) {
      const { data: vals } = await supabase
        .from('faculty_field_values')
        .select('*')
        .in('field_id', allFieldIds)
        .eq('faculty_id', user.id);
      const valMap = {};
      (vals || []).forEach((v) => { valMap[v.field_id] = v.value; });
      setFacultyFieldValues(valMap);
    } else {
      setFacultyFieldValues({});
    }
  }, [selectedClassId, user]);

  const saveFacultyFieldValues = async () => {
    setLoading(true);
    setError(''); setSuccess('');
    try {
      const allFields = facultySections.flatMap((s) => s.fields);
      for (const field of allFields) {
        const value = facultyFieldValues[field.id] || '';
        const { error } = await supabase
          .from('faculty_field_values')
          .upsert({
            field_id: field.id,
            faculty_id: user.id,
            value,
          }, { onConflict: 'field_id,faculty_id' });
        if (error) throw error;
      }
      setSuccess('Faculty details saved!');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  // ──── STUDENT SUBMISSIONS VIEW ────
  const fetchStudentSubmissions = useCallback(async () => {
    if (!selectedClassId) return;
    const { data: csData } = await supabase
      .from('class_students')
      .select('student_id, profiles(id, full_name, username)')
      .eq('class_id', selectedClassId);
    const studs = (csData || []).map((cs) => cs.profiles).filter(Boolean);
    setClassStudents(studs);

    const allFields = studentSections.flatMap((s) => s.fields);
    if (allFields.length > 0) {
      const fieldIds = allFields.map((f) => f.id);
      const { data: vals } = await supabase
        .from('student_field_values')
        .select('*')
        .in('field_id', fieldIds);
      const grouped = {};
      (vals || []).forEach((v) => {
        if (!grouped[v.student_id]) grouped[v.student_id] = {};
        grouped[v.student_id][v.field_id] = v.value;
      });
      setStudentSubmissions(grouped);
    }
  }, [selectedClassId, studentSections]);

  useEffect(() => { fetchAssignedClasses(); }, [fetchAssignedClasses]);
  useEffect(() => {
    if (selectedClassId) {
      fetchStudentSections();
      fetchFacultySections();
    }
  }, [selectedClassId, fetchStudentSections, fetchFacultySections]);
  useEffect(() => {
    if (tab === 'view-students') fetchStudentSubmissions();
  }, [tab, fetchStudentSubmissions]);

  const clearMsg = () => { setError(''); setSuccess(''); };

  const allStudentFields = studentSections.flatMap((s) => s.fields);

  const tabs = [
    { key: 'faculty-fields', label: 'My Details' },
    { key: 'view-students', label: 'View Students' },
  ];

  return (
    <div className="dashboard">
      <Navbar />
      <div className="container">
        <h2>Faculty Dashboard</h2>

        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}

        {/* Class Selector */}
        <div className="card">
          <div className="form-group">
            <label>Select Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => { setSelectedClassId(e.target.value); clearMsg(); }}
            >
              {assignedClasses.length === 0 && <option value="">No classes assigned</option>}
              {assignedClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedClassId && (
          <>
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

            {/* Faculty Fields Tab — sections created by Super Admin, faculty fills values */}
            {tab === 'faculty-fields' && (
              <div className="card">
                <h3>Your Faculty Details</h3>
                {facultySections.length === 0 ? (
                  <p className="text-muted">No faculty sections created for this class yet. Please contact your administrator.</p>
                ) : (
                  <>
                    <FieldRenderer
                      sections={facultySections}
                      values={facultyFieldValues}
                      onChange={setFacultyFieldValues}
                    />
                    <button className="btn" onClick={saveFacultyFieldValues} disabled={loading} style={{ marginTop: '1rem' }}>
                      {loading ? 'Saving...' : 'Save Faculty Details'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* View Students Tab */}
            {tab === 'view-students' && (
              <div className="card">
                <h3>Student Submissions</h3>
                {classStudents.length === 0 ? (
                  <p className="text-muted">No students in this class.</p>
                ) : allStudentFields.length === 0 ? (
                  <p className="text-muted">No student sections/fields created yet. Please contact your administrator.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Username</th>
                          {allStudentFields.map((f) => (
                            <th key={f.id}>{f.field_name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {classStudents.map((s) => (
                          <tr key={s.id}>
                            <td>{s.full_name}</td>
                            <td>{s.username}</td>
                            {allStudentFields.map((f) => (
                              <td key={f.id}>
                                {studentSubmissions[s.id]?.[f.id] || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
