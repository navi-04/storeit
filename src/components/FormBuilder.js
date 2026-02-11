import React, { useState } from 'react';

const FIELD_TYPES = ['text', 'number', 'date', 'textarea', 'dropdown', 'link', 'checkbox'];

/**
 * FormBuilder — creates sections, each containing multiple fields.
 *
 * Props:
 *   sections       — array of { id, section_name, fields: [{ id, field_name, field_type, ... }] }
 *   onSaveSection  — (sectionData) => void   — called to save a new section with its fields
 *   onDeleteSection — (sectionId) => void
 *   onDeleteField  — (fieldId) => void        — delete single field in existing section
 *   onAddField     — (sectionId, fieldData) => void — add field to existing section
 *   loading        — boolean
 */
export default function FormBuilder({ sections, onSaveSection, onDeleteSection, onDeleteField, onAddField, loading }) {
  const [sectionName, setSectionName] = useState('');
  const [fields, setFields] = useState([]);
  const [expandedAdd, setExpandedAdd] = useState({});

  // New field being built for a new section
  const [newField, setNewField] = useState(emptyField());
  const [optionInput, setOptionInput] = useState('');

  // For adding field to existing section
  const [addFieldData, setAddFieldData] = useState({});
  const [addOptionInput, setAddOptionInput] = useState({});

  function emptyField() {
    return { field_name: '', field_type: 'text', field_options: [], required: false, upload_link: '' };
  }

  const addFieldToSection = () => {
    if (!newField.field_name.trim()) return;
    setFields([...fields, { ...newField, field_order: fields.length }]);
    setNewField(emptyField());
    setOptionInput('');
  };

  const removeFieldFromList = (idx) => {
    setFields(fields.filter((_, i) => i !== idx));
  };

  const handleSaveSection = () => {
    if (!sectionName.trim() || fields.length === 0) return;
    onSaveSection({ section_name: sectionName.trim(), fields });
    setSectionName('');
    setFields([]);
    setNewField(emptyField());
  };

  const addOption = () => {
    if (!optionInput.trim()) return;
    setNewField({ ...newField, field_options: [...newField.field_options, optionInput.trim()] });
    setOptionInput('');
  };

  const removeOption = (idx) => {
    setNewField({ ...newField, field_options: newField.field_options.filter((_, i) => i !== idx) });
  };

  // Helpers for adding a field to an existing section
  const toggleExpandAdd = (sectionId) => {
    setExpandedAdd((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
    if (!addFieldData[sectionId]) {
      setAddFieldData((prev) => ({ ...prev, [sectionId]: emptyField() }));
    }
  };

  const updateAddField = (sectionId, updates) => {
    setAddFieldData((prev) => ({ ...prev, [sectionId]: { ...prev[sectionId], ...updates } }));
  };

  const handleAddFieldToExisting = (sectionId, existingFieldCount) => {
    const fd = addFieldData[sectionId];
    if (!fd || !fd.field_name.trim()) return;
    onAddField(sectionId, { ...fd, field_order: existingFieldCount });
    setAddFieldData((prev) => ({ ...prev, [sectionId]: emptyField() }));
    setAddOptionInput((prev) => ({ ...prev, [sectionId]: '' }));
  };

  return (
    <div className="form-builder">
      <h3>Sections</h3>

      {sections.length === 0 && <p className="text-muted">No sections created yet.</p>}

      {/* Existing sections */}
      {sections.map((section) => (
        <div key={section.id} className="section-card">
          <div className="section-header">
            <strong>{section.section_name}</strong>
            <button className="btn btn-sm btn-danger" onClick={() => onDeleteSection(section.id)} disabled={loading}>
              Delete Section
            </button>
          </div>
          <div className="section-fields">
            {(section.fields || []).map((field) => (
              <div key={field.id} className="field-item">
                <div className="field-item-info">
                  <strong>{field.field_name}</strong>
                  <span className="badge">{field.field_type}</span>
                  {field.required && <span className="badge badge-red">Required</span>}
                  {field.upload_link && (
                    <a href={field.upload_link} target="_blank" rel="noopener noreferrer" className="badge" style={{ background: '#dbeafe', color: '#1d4ed8', textDecoration: 'none' }}>
                      Upload Link
                    </a>
                  )}
                  {field.field_type === 'dropdown' && field.field_options?.length > 0 && (
                    <span className="text-muted text-sm">Options: {field.field_options.join(', ')}</span>
                  )}
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => onDeleteField(field.id)} disabled={loading}>
                  Delete
                </button>
              </div>
            ))}
          </div>

          {/* Add field to existing section */}
          <div style={{ marginTop: '0.5rem' }}>
            <button className="btn btn-sm" onClick={() => toggleExpandAdd(section.id)} type="button">
              {expandedAdd[section.id] ? '− Cancel' : '+ Add Field'}
            </button>
            {expandedAdd[section.id] && (
              <div className="add-field-form card" style={{ marginTop: '0.5rem' }}>
                {renderFieldForm(
                  addFieldData[section.id] || emptyField(),
                  (updates) => updateAddField(section.id, updates),
                  addOptionInput[section.id] || '',
                  (val) => setAddOptionInput((prev) => ({ ...prev, [section.id]: val })),
                  () => {
                    const fd = addFieldData[section.id] || emptyField();
                    const opts = [...fd.field_options, (addOptionInput[section.id] || '').trim()].filter(Boolean);
                    updateAddField(section.id, { field_options: opts });
                    setAddOptionInput((prev) => ({ ...prev, [section.id]: '' }));
                  },
                  (idx) => {
                    const fd = addFieldData[section.id] || emptyField();
                    updateAddField(section.id, { field_options: fd.field_options.filter((_, i) => i !== idx) });
                  }
                )}
                <button
                  className="btn btn-sm"
                  onClick={() => handleAddFieldToExisting(section.id, (section.fields || []).length)}
                  disabled={loading || !(addFieldData[section.id]?.field_name?.trim())}
                >
                  {loading ? 'Adding...' : 'Add Field'}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Create new section */}
      <div className="add-field-form card" style={{ marginTop: '1rem' }}>
        <h4>Create New Section</h4>
        <div className="form-group">
          <label>Section Name</label>
          <input
            type="text"
            placeholder="e.g. Personal Details, Academic Info..."
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
          />
        </div>

        {/* Fields added to this section */}
        {fields.length > 0 && (
          <div className="section-fields" style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>Fields in this section:</label>
            {fields.map((f, idx) => (
              <div key={idx} className="field-item">
                <div className="field-item-info">
                  <strong>{f.field_name}</strong>
                  <span className="badge">{f.field_type}</span>
                  {f.required && <span className="badge badge-red">Required</span>}
                  {f.upload_link && <span className="badge" style={{ background: '#dbeafe', color: '#1d4ed8' }}>Has Link</span>}
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => removeFieldFromList(idx)}>Remove</button>
              </div>
            ))}
          </div>
        )}

        {/* Field form for new section */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem', background: '#fff', marginBottom: '0.75rem' }}>
          <label style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem', display: 'block' }}>Add Field</label>
          {renderFieldForm(
            newField,
            (updates) => setNewField({ ...newField, ...updates }),
            optionInput,
            setOptionInput,
            addOption,
            removeOption
          )}
          <button className="btn btn-sm" onClick={addFieldToSection} disabled={!newField.field_name.trim()} type="button">
            + Add Field to Section
          </button>
        </div>

        <button
          className="btn"
          onClick={handleSaveSection}
          disabled={loading || !sectionName.trim() || fields.length === 0}
        >
          {loading ? 'Saving...' : 'Save Section'}
        </button>
      </div>
    </div>
  );
}

function renderFieldForm(field, onChange, optInput, setOptInput, onAddOpt, onRemoveOpt) {
  return (
    <>
      <div className="form-row" style={{ marginBottom: '0.5rem' }}>
        <input
          type="text"
          placeholder="Field Name"
          value={field.field_name}
          onChange={(e) => onChange({ field_name: e.target.value })}
        />
        <select value={field.field_type} onChange={(e) => onChange({ field_type: e.target.value })}>
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="form-group" style={{ marginBottom: '0.5rem' }}>
        <input
          type="text"
          placeholder="External Upload Link (optional)"
          value={field.upload_link || ''}
          onChange={(e) => onChange({ upload_link: e.target.value })}
        />
      </div>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onChange({ required: e.target.checked })}
        />
        Required
      </label>

      {field.field_type === 'dropdown' && (
        <div className="dropdown-options">
          <div className="form-row" style={{ marginBottom: '0.35rem' }}>
            <input
              type="text"
              placeholder="Add option..."
              value={optInput}
              onChange={(e) => setOptInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddOpt())}
            />
            <button className="btn btn-sm" onClick={onAddOpt} type="button">+ Option</button>
          </div>
          <div className="option-tags">
            {(field.field_options || []).map((opt, i) => (
              <span key={i} className="tag">
                {opt}
                <button onClick={() => onRemoveOpt(i)} className="tag-remove">&times;</button>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
