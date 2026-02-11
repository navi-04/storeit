import React from 'react';

/**
 * FieldRenderer — renders sections with grouped fields for filling values.
 *
 * Props:
 *   sections  — array of { id, section_name, fields: [{ id, field_name, field_type, field_options, required, upload_link }] }
 *   values    — { [field_id]: value }
 *   onChange  — (newValues) => void
 *   disabled  — boolean
 */
export default function FieldRenderer({ sections, values, onChange, disabled }) {
  const handleChange = (fieldId, val) => {
    onChange({ ...values, [fieldId]: val });
  };

  if (!sections || sections.length === 0) {
    return <p className="text-muted">No sections to display.</p>;
  }

  return (
    <div className="field-renderer">
      {sections.map((section) => (
        <div key={section.id} className="section-render-card">
          <h4 className="section-render-title">{section.section_name}</h4>
          {(section.fields || []).map((field) => {
            const val = values[field.id] || '';
            return (
              <div key={field.id} className="form-group">
                <label>
                  {field.field_name}
                  {field.required && <span className="required-star"> *</span>}
                  {field.upload_link && (
                    <a
                      href={field.upload_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#4f46e5' }}
                    >
                      (Upload Link)
                    </a>
                  )}
                </label>

                {field.field_type === 'text' && (
                  <input type="text" value={val} onChange={(e) => handleChange(field.id, e.target.value)} disabled={disabled} />
                )}

                {field.field_type === 'number' && (
                  <input type="number" value={val} onChange={(e) => handleChange(field.id, e.target.value)} disabled={disabled} />
                )}

                {field.field_type === 'date' && (
                  <input type="date" value={val} onChange={(e) => handleChange(field.id, e.target.value)} disabled={disabled} />
                )}

                {field.field_type === 'textarea' && (
                  <textarea value={val} onChange={(e) => handleChange(field.id, e.target.value)} disabled={disabled} rows={3} />
                )}

                {field.field_type === 'link' && (
                  <input type="url" value={val} onChange={(e) => handleChange(field.id, e.target.value)} disabled={disabled} placeholder="https://..." />
                )}

                {field.field_type === 'dropdown' && (
                  <select value={val} onChange={(e) => handleChange(field.id, e.target.value)} disabled={disabled}>
                    <option value="">-- Select --</option>
                    {(field.field_options || []).map((opt, i) => (
                      <option key={i} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}

                {field.field_type === 'checkbox' && (
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                    <label className="checkbox-label">
                      <input
                        type="radio"
                        name={`checkbox_${field.id}`}
                        checked={val === 'yes'}
                        onChange={() => handleChange(field.id, 'yes')}
                        disabled={disabled}
                      />
                      Yes
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="radio"
                        name={`checkbox_${field.id}`}
                        checked={val === 'no'}
                        onChange={() => handleChange(field.id, 'no')}
                        disabled={disabled}
                      />
                      No
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
