import React, { useState } from 'react';
import {
  Card,
  Title,
  Text,
  TextInput,
  Select,
  Checkbox,
  Button,
  Group,
  Stack,
  Badge,
  ActionIcon,
  Pill,
  Collapse,
  Divider,
} from '@mantine/core';
import { IconTrash, IconPlus, IconX } from '@tabler/icons-react';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'link', label: 'Link' },
  { value: 'checkbox', label: 'Checkbox' },
];

function emptyField() {
  return { field_name: '', field_type: 'text', field_options: [], required: false, upload_link: '' };
}

function FieldForm({ field, onChange, optInput, setOptInput, onAddOpt, onRemoveOpt }) {
  return (
    <Stack gap="xs">
      <Group grow>
        <TextInput
          placeholder="Field Name"
          value={field.field_name}
          onChange={(e) => onChange({ field_name: e.currentTarget.value })}
          size="sm"
        />
        <Select
          data={FIELD_TYPES}
          value={field.field_type}
          onChange={(v) => onChange({ field_type: v || 'text' })}
          size="sm"
        />
      </Group>

      <TextInput
        placeholder="External Upload Link (optional)"
        value={field.upload_link || ''}
        onChange={(e) => onChange({ upload_link: e.currentTarget.value })}
        size="sm"
      />

      <Checkbox
        label="Required"
        checked={field.required}
        onChange={(e) => onChange({ required: e.currentTarget.checked })}
        size="sm"
      />

      {field.field_type === 'dropdown' && (
        <Card withBorder padding="xs">
          <Group gap="xs">
            <TextInput
              placeholder="Add option..."
              value={optInput}
              onChange={(e) => setOptInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); onAddOpt(); }
              }}
              size="sm"
              style={{ flex: 1 }}
            />
            <Button size="xs" variant="light" onClick={onAddOpt} leftSection={<IconPlus size={14} />}>
              Option
            </Button>
          </Group>
          {(field.field_options || []).length > 0 && (
            <Group gap="xs" mt="xs">
              {field.field_options.map((opt, i) => (
                <Pill
                  key={i}
                  withRemoveButton
                  onRemove={() => onRemoveOpt(i)}
                  size="sm"
                >
                  {opt}
                </Pill>
              ))}
            </Group>
          )}
        </Card>
      )}
    </Stack>
  );
}

export default function FormBuilder({ sections, onSaveSection, onDeleteSection, onDeleteField, onAddField, loading }) {
  const [sectionName, setSectionName] = useState('');
  const [fields, setFields] = useState([]);
  const [expandedAdd, setExpandedAdd] = useState({});
  const [newField, setNewField] = useState(emptyField());
  const [optionInput, setOptionInput] = useState('');
  const [addFieldData, setAddFieldData] = useState({});
  const [addOptionInput, setAddOptionInput] = useState({});

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
    <Stack gap="md">
      <Title order={4}>Sections</Title>

      {sections.length === 0 && <Text c="dimmed">No sections created yet.</Text>}

      {/* Existing sections */}
      {sections.map((section) => (
        <Card key={section.id} withBorder shadow="xs" padding="md">
          <Group justify="space-between" mb="sm">
            <Text fw={600}>{section.section_name}</Text>
            <Button
              size="xs"
              color="red"
              variant="light"
              leftSection={<IconTrash size={14} />}
              onClick={() => onDeleteSection(section.id)}
              disabled={loading}
            >
              Delete Section
            </Button>
          </Group>

          <Stack gap="xs" pl="sm" style={{ borderLeft: '3px solid var(--mantine-color-indigo-4)' }}>
            {(section.fields || []).map((field) => (
              <Group key={field.id} justify="space-between" wrap="wrap">
                <Group gap="xs" wrap="wrap">
                  <Text fw={500} size="sm">{field.field_name}</Text>
                  <Badge size="sm" variant="light">{field.field_type}</Badge>
                  {field.required && <Badge size="sm" color="red" variant="light">Required</Badge>}
                  {field.upload_link && (
                    <Badge size="sm" color="blue" variant="light" component="a" href={field.upload_link} target="_blank" style={{ cursor: 'pointer', textDecoration: 'none' }}>
                      Upload Link
                    </Badge>
                  )}
                  {field.field_type === 'dropdown' && field.field_options?.length > 0 && (
                    <Text size="xs" c="dimmed">Options: {field.field_options.join(', ')}</Text>
                  )}
                </Group>
                <ActionIcon size="sm" color="red" variant="light" onClick={() => onDeleteField(field.id)} disabled={loading}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>

          <Group mt="sm">
            <Button
              size="xs"
              variant="light"
              onClick={() => toggleExpandAdd(section.id)}
              leftSection={expandedAdd[section.id] ? <IconX size={14} /> : <IconPlus size={14} />}
            >
              {expandedAdd[section.id] ? 'Cancel' : 'Add Field'}
            </Button>
          </Group>

          <Collapse in={expandedAdd[section.id]}>
            <Card withBorder padding="sm" mt="xs" bg="gray.0">
              <FieldForm
                field={addFieldData[section.id] || emptyField()}
                onChange={(updates) => updateAddField(section.id, updates)}
                optInput={addOptionInput[section.id] || ''}
                setOptInput={(val) => setAddOptionInput((prev) => ({ ...prev, [section.id]: val }))}
                onAddOpt={() => {
                  const fd = addFieldData[section.id] || emptyField();
                  const opts = [...fd.field_options, (addOptionInput[section.id] || '').trim()].filter(Boolean);
                  updateAddField(section.id, { field_options: opts });
                  setAddOptionInput((prev) => ({ ...prev, [section.id]: '' }));
                }}
                onRemoveOpt={(idx) => {
                  const fd = addFieldData[section.id] || emptyField();
                  updateAddField(section.id, { field_options: fd.field_options.filter((_, i) => i !== idx) });
                }}
              />
              <Button
                size="xs"
                mt="xs"
                onClick={() => handleAddFieldToExisting(section.id, (section.fields || []).length)}
                disabled={loading || !(addFieldData[section.id]?.field_name?.trim())}
              >
                {loading ? 'Adding...' : 'Add Field'}
              </Button>
            </Card>
          </Collapse>
        </Card>
      ))}

      <Divider />

      {/* Create new section */}
      <Card withBorder shadow="xs" padding="md" bg="gray.0">
        <Title order={5} mb="sm">Create New Section</Title>

        <TextInput
          label="Section Name"
          placeholder="e.g. Personal Details, Academic Info..."
          value={sectionName}
          onChange={(e) => setSectionName(e.currentTarget.value)}
          mb="sm"
        />

        {/* Fields staged for this new section */}
        {fields.length > 0 && (
          <Stack gap="xs" mb="sm" pl="sm" style={{ borderLeft: '3px solid var(--mantine-color-indigo-4)' }}>
            <Text size="sm" fw={600}>Fields in this section:</Text>
            {fields.map((f, idx) => (
              <Group key={idx} justify="space-between" wrap="wrap">
                <Group gap="xs" wrap="wrap">
                  <Text fw={500} size="sm">{f.field_name}</Text>
                  <Badge size="sm" variant="light">{f.field_type}</Badge>
                  {f.required && <Badge size="sm" color="red" variant="light">Required</Badge>}
                  {f.upload_link && <Badge size="sm" color="blue" variant="light">Has Link</Badge>}
                </Group>
                <ActionIcon size="sm" color="red" variant="light" onClick={() => removeFieldFromList(idx)}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        )}

        {/* Field form for new section */}
        <Card withBorder padding="sm" mb="sm">
          <Text size="sm" fw={600} mb="xs">Add Field</Text>
          <FieldForm
            field={newField}
            onChange={(updates) => setNewField({ ...newField, ...updates })}
            optInput={optionInput}
            setOptInput={setOptionInput}
            onAddOpt={addOption}
            onRemoveOpt={removeOption}
          />
          <Button
            size="xs"
            mt="xs"
            variant="light"
            onClick={addFieldToSection}
            disabled={!newField.field_name.trim()}
            leftSection={<IconPlus size={14} />}
          >
            Add Field to Section
          </Button>
        </Card>

        <Button
          onClick={handleSaveSection}
          disabled={loading || !sectionName.trim() || fields.length === 0}
          loading={loading}
        >
          Save Section
        </Button>
      </Card>
    </Stack>
  );
}
