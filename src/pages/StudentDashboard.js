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

  // Fetch all data in one go to avoid multiple loading states
  const fetchAllData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // First get assigned class
      const { data, error } = await supabase
        .from('class_students')
        .select('class_id, classes(id, name)')
        .eq('student_id', user.id)
        .limit(1)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          setAssignedClass(null);
          setSections([]);
          setValues({});
          return;
        } else {
          throw error;
        }
      }

      const classData = data?.classes || null;
      setAssignedClass(classData);

      if (!classData?.id) {
        setSections([]);
        setValues({});
        return;
      }

      // Fetch sections and fields for this class
      const { data: secData, error: secErr } = await supabase
        .from('student_sections')
        .select('*')
        .eq('class_id', classData.id)
        .order('section_order');
      if (secErr) throw secErr;

      const secs = secData || [];
      if (secs.length === 0) { 
        setSections([]); 
        setValues({}); 
        return; 
      }

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
        (valData || []).forEach((v) => { 
          valMap[v.field_id] = v.value;
        });
        setValues(valMap);
      } else {
        setValues({});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const handleRefresh = async () => {
    setError('');
    setSuccess('');
    await fetchAllData();
    setSuccess('Page refreshed successfully!');
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const allFields = sections.flatMap((s) => s.fields);
      
      if (allFields.length === 0) {
        setError('No fields to save. Please refresh the page.');
        setSaving(false);
        return;
      }

      // First verify all fields exist in the database
      const fieldIds = allFields.map(f => f.id);
      const { data: existingFields, error: checkError } = await supabase
        .from('student_section_fields')
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
        
        const value = values[field.id] || '';
        const { error } = await supabase
          .from('student_field_values')
          .upsert({
            field_id: field.id,
            student_id: user.id,
            value,
          }, { onConflict: 'field_id,student_id' });
        
        if (error) {
          console.error(`Error saving field ${field.id}:`, error);
          skippedCount++;
        } else {
          savedCount++;
        }
      }
      
      if (skippedCount > 0) {
        setSuccess(`Details saved! (${savedCount} fields saved, ${skippedCount} fields skipped due to errors)`);
      } else {
        setSuccess('All details saved successfully!');
      }
    } catch (err) {
      setError(`Error saving: ${err.message}. Please refresh the page and try again.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard">
      <Navbar />
      <div className="container">
        <div style={{ position: 'relative' }}>
          <h2>Student Dashboard</h2>
        </div>

        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}

        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
            <p style={{ color: 'var(--text-muted)' }}>Loading your dashboard...</p>
          </div>
        ) : !assignedClass ? (
          <div className="card">
            <p className="text-muted">You have not been assigned to any class yet. Please contact your administrator.</p>
          </div>
        ) : (
          <>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0 }}><strong>Class:</strong> {assignedClass.name}</p>
                <button 
                  className="btn btn-sm" 
                  onClick={handleRefresh}
                  disabled={loading}
                  title="Refresh to get latest form fields"
                >
                  {loading ? 'Refreshing...' : '🔄 Refresh'}
                </button>
              </div>
            </div>

            <div className="card">
              <h3>Your Details</h3>
              {sections.length === 0 ? (
                <p className="text-muted">No sections created by your administrator yet.</p>
              ) : (
                <>
                  <FieldRenderer
                    sections={sections}
                    values={values}
                    onChange={setValues}
                    disabled={saving}
                  />
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn"
                      onClick={handleSubmit}
                      disabled={saving || loading}
                    >
                      {saving ? 'Saving...' : 'Save Details'}
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={handleRefresh}
                      disabled={saving || loading}
                      style={{ background: '#6b7280', color: 'white' }}
                    >
                      {loading ? 'Refreshing...' : 'Refresh Form'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
