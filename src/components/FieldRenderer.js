import React from 'react';
import {
  TextInput,
  NumberInput,
  Textarea,
  Select,
  Radio,
  Stack,
  Card,
  Title,
  Text,
  Anchor,
  Group,
} from '@mantine/core';

/**
 * FieldRenderer — renders sections with grouped fields for filling values.
 *
 * Props:
 *   sections  — array of { id, section_name, fields: [...] }
 *   values    — { [field_id]: value }
 *   onChange  — (newValues) => void
 *   disabled  — boolean
 */
export default function FieldRenderer({ sections, values, onChange, disabled }) {
  const handleChange = (fieldId, val) => {
    onChange({ ...values, [fieldId]: val });
  };

  if (!sections || sections.length === 0) {
    return <Text c="dimmed">No sections to display.</Text>;
  }

  return (
    <Stack gap="md">
      {sections.map((section) => (
        <Card key={section.id} withBorder shadow="xs" padding="lg">
          <Title order={5} c="indigo" mb="md" pb="xs" style={{ borderBottom: '2px solid var(--mantine-color-indigo-5)' }}>
            {section.section_name}
          </Title>
          <Stack gap="sm">
            {(section.fields || []).map((field) => {
              const val = values[field.id] || '';
              const label = (
                <Group gap={4}>
                  <span>{field.field_name}</span>
                  {field.required && <Text component="span" c="red" fw={700}> *</Text>}
                  {field.upload_link && (
                    <Anchor
                      href={field.upload_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="xs"
                      ml="xs"
                    >
                      (Upload Link)
                    </Anchor>
                  )}
                </Group>
              );

              if (field.field_type === 'text') {
                return (
                  <TextInput
                    key={field.id}
                    label={label}
                    value={val}
                    onChange={(e) => handleChange(field.id, e.currentTarget.value)}
                    disabled={disabled}
                  />
                );
              }

              if (field.field_type === 'number') {
                return (
                  <NumberInput
                    key={field.id}
                    label={label}
                    value={val === '' ? '' : Number(val)}
                    onChange={(v) => handleChange(field.id, String(v ?? ''))}
                    disabled={disabled}
                    hideControls
                  />
                );
              }

              if (field.field_type === 'date') {
                return (
                  <TextInput
                    key={field.id}
                    label={label}
                    type="date"
                    value={val}
                    onChange={(e) => handleChange(field.id, e.currentTarget.value)}
                    disabled={disabled}
                  />
                );
              }

              if (field.field_type === 'textarea') {
                return (
                  <Textarea
                    key={field.id}
                    label={label}
                    value={val}
                    onChange={(e) => handleChange(field.id, e.currentTarget.value)}
                    disabled={disabled}
                    minRows={3}
                    autosize
                  />
                );
              }

              if (field.field_type === 'link') {
                return (
                  <TextInput
                    key={field.id}
                    label={label}
                    type="url"
                    placeholder="https://..."
                    value={val}
                    onChange={(e) => handleChange(field.id, e.currentTarget.value)}
                    disabled={disabled}
                  />
                );
              }

              if (field.field_type === 'dropdown') {
                return (
                  <Select
                    key={field.id}
                    label={label}
                    placeholder="-- Select --"
                    value={val || null}
                    onChange={(v) => handleChange(field.id, v || '')}
                    data={(field.field_options || []).map((opt) => ({ value: opt, label: opt }))}
                    disabled={disabled}
                    clearable
                  />
                );
              }

              if (field.field_type === 'checkbox') {
                return (
                  <Radio.Group
                    key={field.id}
                    label={label}
                    value={val}
                    onChange={(v) => handleChange(field.id, v)}
                  >
                    <Group mt="xs">
                      <Radio value="yes" label="Yes" disabled={disabled} />
                      <Radio value="no" label="No" disabled={disabled} />
                    </Group>
                  </Radio.Group>
                );
              }

              return null;
            })}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
