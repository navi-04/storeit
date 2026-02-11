import React, { useState } from 'react';

const FIELD_TYPES = ['text', 'number', 'date', 'textarea', 'dropdown'];

export default function FormBuilder({ fields, onSave, onDelete, loading }) {
  const [newField, setNewField] = useState({
    field_name: '',
    field_type: 'text',
    field_options: [],
    required: false,
  });
  const [optionInput, setOptionInput] = useState('');

  const handleAddField = () => {
    if (!newField.field_name.trim()) return;
    onSave({
      ...newField,
      field_order: fields.length,
    });
    setNewField({ field_name: '', field_type: 'text', field_options: [], required: false });
    setOptionInput('');
  };

  const addOption = () => {
    if (!optionInput.trim()) return;
    setNewField({
      ...newField,
      field_options: [...newField.field_options, optionInput.trim()],
    });
    setOptionInput('');
  };

  const removeOption = (idx) => {
    setNewField({
      ...newField,
      field_options: newField.field_options.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="form-builder">
      <h3>Form Fields</h3>

      {fields.length === 0 && <p className="text-muted">No fields created yet.</p>}

      <div className="field-list">
        {fields.map((field, idx) => (
          <div key={field.id} className="field-item">
            <div className="field-item-info">
              <strong>{field.field_name}</strong>
              <span className="badge">{field.field_type}</span>
              {field.required && <span className="badge badge-red">Required</span>}
              {field.field_type === 'dropdown' && field.field_options?.length > 0 && (
                <span className="text-muted text-sm">
                  Options: {(field.field_options || []).join(', ')}
                </span>
              )}
            </div>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => onDelete(field.id)}
              disabled={loading}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="add-field-form card">
        <h4>Add New Field</h4>
        <div className="form-row">
          <input
            type="text"
            placeholder="Field Name"
            value={newField.field_name}
            onChange={(e) => setNewField({ ...newField, field_name: e.target.value })}
          />
          <select
            value={newField.field_type}
            onChange={(e) => setNewField({ ...newField, field_type: e.target.value })}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={newField.required}
            onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
          />
          Required
        </label>

        {newField.field_type === 'dropdown' && (
          <div className="dropdown-options">
            <div className="form-row">
              <input
                type="text"
                placeholder="Add option..."
                value={optionInput}
                onChange={(e) => setOptionInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
              />
              <button className="btn btn-sm" onClick={addOption} type="button">
                + Option
              </button>
            </div>
            <div className="option-tags">
              {newField.field_options.map((opt, i) => (
                <span key={i} className="tag">
                  {opt}
                  <button onClick={() => removeOption(i)} className="tag-remove">&times;</button>
                </span>
              ))}
            </div>
          </div>
        )}

        <button className="btn" onClick={handleAddField} disabled={loading || !newField.field_name.trim()}>
          {loading ? 'Adding...' : 'Add Field'}
        </button>
      </div>
    </div>
  );
}
