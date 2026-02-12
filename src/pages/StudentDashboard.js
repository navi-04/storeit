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
    
    console.log('Fetching sections for class:', assignedClass.id);
    console.log('Current user:', user);
    
    try {
      const { data: secData, error: secErr } = await supabase
        .from('student_sections')
        .select('*')
        .eq('class_id', assignedClass.id)
        .order('section_order');
      if (secErr) throw secErr;

      console.log('Sections found:', secData);

      const secs = secData || [];
      if (secs.length === 0) { 
        console.log('No sections found');
        setSections([]); 
        setValues({}); 
        setLoading(false); 
        return; 
      }

      const sectionIds = secs.map((s) => s.id);
      const { data: fieldData, error: fErr } = await supabase
        .from('student_section_fields')
        .select('*')
        .in('section_id', sectionIds)
        .order('field_order');
      if (fErr) throw fErr;

      console.log('Fields found:', fieldData);

      const result = secs.map((sec) => ({
        ...sec,
        fields: (fieldData || []).filter((f) => f.section_id === sec.id),
      }));
      setSections(result);

      // Fetch student's values
      const allFieldIds = (fieldData || []).map((f) => f.id);
      console.log('Looking for values for field IDs:', allFieldIds);
      
      if (allFieldIds.length > 0) {
        const { data: valData, error: valErr } = await supabase
          .from('student_field_values')
          .select('*')
          .in('field_id', allFieldIds)
          .eq('student_id', user.id);
        
        if (valErr) {
          console.error('Error fetching values:', valErr);
        }
        
        console.log('Values found in DB:', valData);
        
        const valMap = {};
        (valData || []).forEach((v) => { 
          valMap[v.field_id] = v.value;
          console.log(`Loaded value for field ${v.field_id}:`, v.value);
        });
        setValues(valMap);
      } else {
        setValues({});
      }
    } catch (err) {
      console.error('Error in fetchSectionsAndValues:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [assignedClass, user]);

  useEffect(() => { fetchAssignedClass(); }, [fetchAssignedClass]);
  useEffect(() => { fetchSectionsAndValues(); }, [fetchSectionsAndValues]);

  const handleRefresh = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    await fetchAssignedClass();
    await fetchSectionsAndValues();
    setSuccess('Page refreshed successfully!');
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setSaving(true);
    
    console.log('Starting save process...');
    console.log('Current values:', values);
    console.log('User ID:', user?.id);
    
    try {
      const allFields = sections.flatMap((s) => s.fields);
      
      console.log('All fields:', allFields);
      
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
      
      if (checkError) {
        console.error('Error checking fields:', checkError);
        throw checkError;
      }
      
      console.log('Existing fields in DB:', existingFields);
      
      const existingFieldIds = new Set((existingFields || []).map(f => f.id));
      
      // Only save values for fields that exist
      let savedCount = 0;
      let skippedCount = 0;
      let errors = [];
      
      for (const field of allFields) {
        if (!existingFieldIds.has(field.id)) {
          console.log(`Skipping field ${field.id} - does not exist in DB`);
          skippedCount++;
          continue;
        }
        
        const value = values[field.id] || '';
        console.log(`Saving field ${field.id} (${field.field_name}):`, value);
        
        const { data, error } = await supabase
          .from('student_field_values')
          .upsert({
            field_id: field.id,
            student_id: user.id,
            value,
          }, { onConflict: 'field_id,student_id' });
        
        if (error) {
          console.error(`Error saving field ${field.id}:`, error);
          errors.push({ field: field.field_name, error: error.message });
          skippedCount++;
        } else {
          console.log(`Successfully saved field ${field.id}`, data);
          savedCount++;
        }
      }
      
      if (errors.length > 0) {
        console.error('Errors during save:', errors);
        setError(`Some fields failed to save: ${errors.map(e => e.field).join(', ')}. Error: ${errors[0].error}`);
      }
      
      if (skippedCount > 0) {
        setSuccess(`Details saved! (${savedCount} fields saved, ${skippedCount} fields skipped due to errors)`);
        // Refresh the sections to get current state
        await fetchSectionsAndValues();
      } else {
        setSuccess(`All details saved successfully! (${savedCount} fields saved)`);
        // Refresh to confirm data was saved
        await fetchSectionsAndValues();
      }
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      setError(`Error saving: ${err.message}. Please refresh the page and try again.`);
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
                  
                  {/* Debug info - shows what data will be saved */}
                  <details style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '4px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      🔍 Debug Info (click to expand)
                    </summary>
                    <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', marginTop: '0.5rem' }}>
                      <p><strong>Total fields:</strong> {sections.flatMap(s => s.fields).length}</p>
                      <p><strong>Filled fields:</strong> {Object.keys(values).filter(k => values[k]).length}</p>
                      <p><strong>User ID:</strong> {user?.id || 'Not found'}</p>
                      <p><strong>Class ID:</strong> {assignedClass?.id || 'Not found'}</p>
                      <div style={{ marginTop: '0.5rem', maxHeight: '200px', overflow: 'auto' }}>
                        <strong>Current values:</strong>
                        <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {JSON.stringify(values, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </details>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
