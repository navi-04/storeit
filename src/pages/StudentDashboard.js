import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import FieldRenderer from '../components/FieldRenderer';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [assignedClasses, setAssignedClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [fields, setFields] = useState([]);
  const [values, setValues] = useState({});

  const fetchAssignedClasses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('class_students')
      .select('class_id, classes(id, name)')
      .eq('student_id', user.id);
    if (error) { setError(error.message); setLoading(false); return; }
    const cls = (data || []).map((cs) => cs.classes).filter(Boolean);
    setAssignedClasses(cls);
    if (cls.length > 0 && !selectedClassId) {
      setSelectedClassId(cls[0].id);
    }
    setLoading(false);
  }, [user, selectedClassId]);

  const fetchFieldsAndValues = useCallback(async () => {
    if (!selectedClassId || !user) return;
    setLoading(true);
    try {
      // Fetch student fields for this class
      const { data: fieldData, error: fieldErr } = await supabase
        .from('student_fields')
        .select('*')
        .eq('class_id', selectedClassId)
        .order('field_order');
      if (fieldErr) throw fieldErr;
      setFields(fieldData || []);

      // Fetch student's own values
      if (fieldData && fieldData.length > 0) {
        const fieldIds = fieldData.map((f) => f.id);
        const { data: valData, error: valErr } = await supabase
          .from('student_field_values')
          .select('*')
          .in('field_id', fieldIds)
          .eq('student_id', user.id);
        if (valErr) throw valErr;
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
  }, [selectedClassId, user]);

  useEffect(() => { fetchAssignedClasses(); }, [fetchAssignedClasses]);
  useEffect(() => { fetchFieldsAndValues(); }, [fetchFieldsAndValues]);

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      for (const field of fields) {
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

        {/* Class Selector */}
        <div className="card">
          <div className="form-group">
            <label>Your Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              {assignedClasses.length === 0 && <option value="">No classes assigned</option>}
              {assignedClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dynamic Form */}
        {selectedClassId && (
          <div className="card">
            <h3>Your Details</h3>
            {loading ? (
              <p>Loading fields...</p>
            ) : fields.length === 0 ? (
              <p className="text-muted">No fields created by your faculty yet.</p>
            ) : (
              <>
                <FieldRenderer
                  fields={fields}
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
        )}
      </div>
    </div>
  );
}
