import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import FieldRenderer from '../components/FieldRenderer';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [assignedClass, setAssignedClass] = useState(null);
  const [sections, setSections] = useState([]);
  const [values, setValues] = useState({});

  // Auto-detect the single class this student belongs to
  const fetchAssignedClass = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('class_students')
        .select('class_id, classes(id, name)')
        .eq('student_id', user.id)
        .limit(1)
        .single();
      if (error) {
        if (error.code === 'PGRST116') {
          // No rows — student not assigned to any class
          setAssignedClass(null);
        } else {
          throw error;
        }
      } else {
        setAssignedClass(data?.classes || null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch sections + fields + student's values
  const fetchSectionsAndValues = useCallback(async () => {
    if (!assignedClass || !user) return;
    setLoading(true);
    try {
      const { data: secData, error: secErr } = await supabase
        .from('student_sections')
        .select('*')
        .eq('class_id', assignedClass.id)
        .order('section_order');
      if (secErr) throw secErr;

      const secs = secData || [];
      if (secs.length === 0) { setSections([]); setValues({}); setLoading(false); return; }

      const sectionIds = secs.map((s) => s.id);
      const { data: fieldData, error: fErr } = await supabase
        .from('student_section_fields')
        .select('*')
        .in('section_id', sectionIds)
        .order('field_order');
      if (fErr) throw fErr;

      const result = secs.map((sec) => ({
        ...sec,
        fields: (fieldData || []).filter((f) => f.section_id === sec.id),
      }));
      setSections(result);

      // Fetch student's values
      const allFieldIds = (fieldData || []).map((f) => f.id);
      if (allFieldIds.length > 0) {
        const { data: valData } = await supabase
          .from('student_field_values')
          .select('*')
          .in('field_id', allFieldIds)
          .eq('student_id', user.id);
        const valMap = {};
        (valData || []).forEach((v) => { valMap[v.field_id] = v.value; });
        setValues(valMap);
      } else {
        setValues({});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [assignedClass, user]);

  useEffect(() => { fetchAssignedClass(); }, [fetchAssignedClass]);
  useEffect(() => { fetchSectionsAndValues(); }, [fetchSectionsAndValues]);

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const allFields = sections.flatMap((s) => s.fields);
      for (const field of allFields) {
        const value = values[field.id] || '';
        const { error } = await supabase
          .from('student_field_values')
          .upsert({
            field_id: field.id,
            student_id: user.id,
            value,
          }, { onConflict: 'field_id,student_id' });
        if (error) throw error;
      }
      setSuccess('Details saved successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard">
      <Navbar />
      <div className="container">
        <h2>Student Dashboard</h2>

        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}

        {loading ? (
          <p>Loading...</p>
        ) : !assignedClass ? (
          <div className="card">
            <p className="text-muted">You have not been assigned to any class yet. Please contact your administrator.</p>
          </div>
        ) : (
          <>
            <div className="card">
              <p><strong>Class:</strong> {assignedClass.name}</p>
            </div>

            <div className="card">
              <h3>Your Details</h3>
              {sections.length === 0 ? (
                <p className="text-muted">No sections created by your faculty yet.</p>
              ) : (
                <>
                  <FieldRenderer
                    sections={sections}
                    values={values}
                    onChange={setValues}
                    disabled={saving}
                  />
                  <button
                    className="btn"
                    onClick={handleSubmit}
                    disabled={saving}
                    style={{ marginTop: '1rem' }}
                  >
                    {saving ? 'Saving...' : 'Save Details'}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
