import React from 'react';

export default function FieldRenderer({ fields, values, onChange, disabled }) {
  const handleChange = (fieldId, val) => {
    onChange({ ...values, [fieldId]: val });
  };

  return (
    <div className="field-renderer">
      {fields.map((field) => {
        const val = values[field.id] || '';
        return (
          <div key={field.id} className="form-group">
            <label>
              {field.field_name}
              {field.required && <span className="required-star"> *</span>}
            </label>

            {field.field_type === 'text' && (
              <input
                type="text"
                value={val}
                onChange={(e) => handleChange(field.id, e.target.value)}
                disabled={disabled}
              />
            )}

            {field.field_type === 'number' && (
              <input
                type="number"
                value={val}
                onChange={(e) => handleChange(field.id, e.target.value)}
                disabled={disabled}
              />
            )}

            {field.field_type === 'date' && (
              <input
                type="date"
                value={val}
                onChange={(e) => handleChange(field.id, e.target.value)}
                disabled={disabled}
              />
            )}

            {field.field_type === 'textarea' && (
              <textarea
                value={val}
                onChange={(e) => handleChange(field.id, e.target.value)}
                disabled={disabled}
                rows={3}
              />
            )}

            {field.field_type === 'dropdown' && (
              <select
                value={val}
                onChange={(e) => handleChange(field.id, e.target.value)}
                disabled={disabled}
              >
                <option value="">-- Select --</option>
                {(field.field_options || []).map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </div>
  );
}
