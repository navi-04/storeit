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
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('class_faculty')
      .select('class_id, classes(id, name)')
      .eq('faculty_id', user.id);
    if (error) { setError(error.message); return; }
    const cls = (data || []).map((cf) => cf.classes).filter(Boolean);
    setAssignedClasses(cls);
    // Only set initial class if none selected
    setSelectedClassId(prev => prev || (cls.length > 0 ? cls[0].id : ''));
  }, [user?.id]);

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
    if (!selectedClassId || !user?.id) return;
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
  }, [selectedClassId, user?.id]);

  const saveFacultyFieldValues = async () => {
    setLoading(true);
    setError(''); setSuccess('');
    try {
      const allFields = facultySections.flatMap((s) => s.fields);
      
      if (allFields.length === 0) {
        setError('No fields to save. Please refresh the page.');
        setLoading(false);
        return;
      }

      // First verify all fields exist in the database
      const fieldIds = allFields.map(f => f.id);
      const { data: existingFields, error: checkError } = await supabase
        .from('faculty_section_fields')
        .select('id')
        .in('id', fieldIds);
      
      if (checkError) throw checkError;
      
      const existingFieldIds = new Set((existingFields || []).map(f => f.id));
      
      // Only save values for fields that exist
      let savedCount = 0;
      let skippedCount = 0;
      
      for (const field of allFields) {
        if (!existingFieldIds.has(field.id)) {
          skippedCount++;
          continue;
        }
        
        const value = facultyFieldValues[field.id] || '';
        const { error } = await supabase
          .from('faculty_field_values')
          .upsert({
            field_id: field.id,
            faculty_id: user.id,
            value,
          }, { onConflict: 'field_id,faculty_id' });
        
        if (error) {
          console.error(`Error saving field ${field.id}:`, error);
          skippedCount++;
        } else {
          savedCount++;
        }
      }
      
      if (skippedCount > 0) {
        setSuccess(`Faculty details saved! (${savedCount} fields saved, ${skippedCount} fields skipped due to errors)`);
        await fetchFacultySections();
      } else {
        setSuccess('Faculty details saved successfully!');
      }
    } catch (err) { 
      setError(`Error saving: ${err.message}. Please refresh the page and try again.`); 
    }
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

    // Fetch student sections and fields to get field IDs
    const { data: secData } = await supabase
      .from('student_sections')
      .select('id')
      .eq('class_id', selectedClassId);
    
    if (secData && secData.length > 0) {
      const sectionIds = secData.map(s => s.id);
      const { data: fieldData } = await supabase
        .from('student_section_fields')
        .select('id')
        .in('section_id', sectionIds);
      
      if (fieldData && fieldData.length > 0) {
        const fieldIds = fieldData.map((f) => f.id);
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
    }
  }, [selectedClassId]);

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

  const handleRefresh = async () => {
    clearMsg();
    setLoading(true);
    await fetchStudentSections();
    await fetchFacultySections();
    if (tab === 'view-students') {
      await fetchStudentSubmissions();
    }
    setSuccess('Page refreshed successfully!');
    setLoading(false);
  };

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0 }}>Your Faculty Details</h3>
                  <button 
                    className="btn btn-sm" 
                    onClick={handleRefresh}
                    disabled={loading}
                    title="Refresh to get latest form fields"
                  >
                    {loading ? 'Refreshing...' : '🔄 Refresh'}
                  </button>
                </div>
                {facultySections.length === 0 ? (
                  <p className="text-muted">No faculty sections created for this class yet. Please contact your administrator.</p>
                ) : (
                  <>
                    <FieldRenderer
                      sections={facultySections}
                      values={facultyFieldValues}
                      onChange={setFacultyFieldValues}
                    />
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className="btn" 
                        onClick={saveFacultyFieldValues} 
                        disabled={loading}
                      >
                        {loading ? 'Saving...' : 'Save Faculty Details'}
                      </button>
                      <button
                        className="btn btn-outline"
                        onClick={handleRefresh}
                        disabled={loading}
                        style={{ background: '#6b7280', color: 'white' }}
                      >
                        {loading ? 'Refreshing...' : 'Refresh Form'}
                      </button>
                    </div>
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
