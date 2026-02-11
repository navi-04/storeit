import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import FormBuilder from '../components/FormBuilder';
import FieldRenderer from '../components/FieldRenderer';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('student-fields');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [assignedClasses, setAssignedClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  // Student fields
  const [studentFields, setStudentFields] = useState([]);
  // Faculty fields
  const [facultyFields, setFacultyFields] = useState([]);
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

  const fetchStudentFields = useCallback(async () => {
    if (!selectedClassId) return;
    const { data, error } = await supabase
      .from('student_fields')
      .select('*')
      .eq('class_id', selectedClassId)
      .order('field_order');
    if (error) setError(error.message);
    else setStudentFields(data || []);
  }, [selectedClassId]);

  const fetchFacultyFields = useCallback(async () => {
    if (!selectedClassId) return;
    const { data, error } = await supabase
      .from('faculty_fields')
      .select('*')
      .eq('class_id', selectedClassId)
      .order('field_order');
    if (error) { setError(error.message); return; }
    setFacultyFields(data || []);

    // Fetch faculty's own values for these fields
    if (data && data.length > 0) {
      const fieldIds = data.map((f) => f.id);
      const { data: vals } = await supabase
        .from('faculty_field_values')
        .select('*')
        .in('field_id', fieldIds)
        .eq('faculty_id', user.id);
      const valMap = {};
      (vals || []).forEach((v) => { valMap[v.field_id] = v.value; });
      setFacultyFieldValues(valMap);
    }
  }, [selectedClassId, user]);

  const fetchStudentSubmissions = useCallback(async () => {
    if (!selectedClassId) return;
    // Get students in this class
    const { data: csData } = await supabase
      .from('class_students')
      .select('student_id, profiles(id, full_name, username)')
      .eq('class_id', selectedClassId);
    const studs = (csData || []).map((cs) => cs.profiles).filter(Boolean);
    setClassStudents(studs);

    // Get all field values for this class's fields
    if (studentFields.length > 0) {
      const fieldIds = studentFields.map((f) => f.id);
      const { data: vals } = await supabase
        .from('student_field_values')
        .select('*')
        .in('field_id', fieldIds);
      // Group by student_id
      const grouped = {};
      (vals || []).forEach((v) => {
        if (!grouped[v.student_id]) grouped[v.student_id] = {};
        grouped[v.student_id][v.field_id] = v.value;
      });
      setStudentSubmissions(grouped);
    }
  }, [selectedClassId, studentFields]);

  useEffect(() => { fetchAssignedClasses(); }, [fetchAssignedClasses]);
  useEffect(() => {
    if (selectedClassId) {
      fetchStudentFields();
      fetchFacultyFields();
    }
  }, [selectedClassId, fetchStudentFields, fetchFacultyFields]);
  useEffect(() => {
    if (tab === 'view-students') fetchStudentSubmissions();
  }, [tab, fetchStudentSubmissions]);

  const clearMsg = () => { setError(''); setSuccess(''); };

  const addStudentField = async (field) => {
    clearMsg();
    setLoading(true);
    try {
      const { error } = await supabase.from('student_fields').insert({
        class_id: selectedClassId,
        field_name: field.field_name,
        field_type: field.field_type,
        field_options: field.field_options,
        field_order: field.field_order,
        required: field.required,
        created_by: user.id,
      });
      if (error) throw error;
      setSuccess('Field added!');
      await fetchStudentFields();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const deleteStudentField = async (fieldId) => {
    clearMsg();
    setLoading(true);
    try {
      const { error } = await supabase.from('student_fields').delete().eq('id', fieldId);
      if (error) throw error;
      await fetchStudentFields();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const addFacultyField = async (field) => {
    clearMsg();
    setLoading(true);
    try {
      const { error } = await supabase.from('faculty_fields').insert({
        class_id: selectedClassId,
        field_name: field.field_name,
        field_type: field.field_type,
        field_options: field.field_options,
        field_order: field.field_order,
        required: field.required,
        created_by: user.id,
      });
      if (error) throw error;
      setSuccess('Faculty field added!');
      await fetchFacultyFields();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const deleteFacultyField = async (fieldId) => {
    clearMsg();
    setLoading(true);
    try {
      const { error } = await supabase.from('faculty_fields').delete().eq('id', fieldId);
      if (error) throw error;
      await fetchFacultyFields();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const saveFacultyFieldValues = async () => {
    clearMsg();
    setLoading(true);
    try {
      for (const field of facultyFields) {
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

  const tabs = [
    { key: 'student-fields', label: 'Student Fields' },
    { key: 'faculty-fields', label: 'Faculty Fields' },
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

            {/* Student Fields Tab */}
            {tab === 'student-fields' && (
              <FormBuilder
                fields={studentFields}
                onSave={addStudentField}
                onDelete={deleteStudentField}
                loading={loading}
              />
            )}

            {/* Faculty Fields Tab */}
            {tab === 'faculty-fields' && (
              <div>
                <FormBuilder
                  fields={facultyFields}
                  onSave={addFacultyField}
                  onDelete={deleteFacultyField}
                  loading={loading}
                />
                {facultyFields.length > 0 && (
                  <div className="card" style={{ marginTop: '1rem' }}>
                    <h3>Fill Your Faculty Details</h3>
                    <FieldRenderer
                      fields={facultyFields}
                      values={facultyFieldValues}
                      onChange={setFacultyFieldValues}
                    />
                    <button className="btn" onClick={saveFacultyFieldValues} disabled={loading}>
                      {loading ? 'Saving...' : 'Save Faculty Details'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* View Students Tab */}
            {tab === 'view-students' && (
              <div className="card">
                <h3>Student Submissions</h3>
                {classStudents.length === 0 ? (
                  <p className="text-muted">No students in this class.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Username</th>
                          {studentFields.map((f) => (
                            <th key={f.id}>{f.field_name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {classStudents.map((s) => (
                          <tr key={s.id}>
                            <td>{s.full_name}</td>
                            <td>{s.username}</td>
                            {studentFields.map((f) => (
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
