import React, { useEffect, useState, useCallback } from 'react';
import {
  AppShell, Container, Title, Card, Text, Button, Group,
  Stack, Loader, Center, Alert, Badge, Select,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconRefresh, IconDeviceFloppy } from '@tabler/icons-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import FieldRenderer from '../components/FieldRenderer';

export function StudentDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [myClasses, setMyClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [studentSections, setStudentSections] = useState([]);
  const [fieldValues, setFieldValues] = useState({});

  const fetchAllData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Find all classes assigned to this student
      const { data: csData } = await supabase
        .from('class_students')
        .select('class_id, classes(id, name)')
        .eq('student_id', user.id);

      const classes = (csData || []).map((cs) => cs.classes).filter(Boolean);
      setMyClasses(classes);

      if (classes.length === 0) {
        setSelectedClassId('');
        setStudentSections([]);
        setFieldValues({});
        setLoading(false);
        return;
      }

      const activeClassId = selectedClassId && classes.some((c) => c.id === selectedClassId)
        ? selectedClassId
        : classes[0].id;

      if (activeClassId !== selectedClassId) {
        setSelectedClassId(activeClassId);
      }

      // Fetch sections + fields
      const { data: secData } = await supabase
        .from('student_sections').select('*').eq('class_id', activeClassId).order('section_order');
      const secs = secData || [];
      let fields = [];
      if (secs.length > 0) {
        const ids = secs.map((s) => s.id);
        const { data: fData } = await supabase
          .from('student_section_fields').select('*').in('section_id', ids).order('field_order');
        fields = fData || [];
      }
      setStudentSections(secs.map((s) => ({ ...s, fields: fields.filter((f) => f.section_id === s.id) })));

      // Fetch my values
      if (fields.length > 0) {
        const fieldIds = fields.map((f) => f.id);
        const { data: vals } = await supabase
          .from('student_field_values').select('*').in('field_id', fieldIds).eq('student_id', user.id);
        const valMap = {};
        (vals || []).forEach((v) => { valMap[v.field_id] = v.value; });
        setFieldValues(valMap);
      } else {
        setFieldValues({});
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [user?.id, selectedClassId]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const handleFieldChange = (fieldId, value) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const saveData = async () => {
    setError(''); setLoading(true);
    try {
      const allFields = studentSections.flatMap((s) => s.fields);
      for (const field of allFields) {
        const value = fieldValues[field.id] || '';
        const { data: existing } = await supabase
          .from('student_field_values').select('id').eq('field_id', field.id).eq('student_id', user.id).maybeSingle();
        if (existing) {
          const { error } = await supabase.from('student_field_values').update({ value }).eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('student_field_values').insert({ field_id: field.id, student_id: user.id, value });
          if (error) throw error;
        }
      }
      notifications.show({ message: 'Data saved!', color: 'green' });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header bg="indigo.6"><Navbar /></AppShell.Header>
      <AppShell.Main>
        <Container size="lg" py="lg">
          <Title order={2} mb="lg">Student Dashboard</Title>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md" withCloseButton onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Center py="xl"><Loader /></Center>
          ) : myClasses.length === 0 ? (
            <Card withBorder padding="lg">
              <Text c="dimmed">You haven't been assigned to any class yet. Ask your Super Admin to add you.</Text>
            </Card>
          ) : (
            <>
              <Card withBorder padding="lg" mb="lg">
                <Stack gap="sm">
                  <Group>
                    <Text fw={500}>Your Classes ({myClasses.length}):</Text>
                  </Group>
                  <Group gap="xs" wrap="wrap">
                    {myClasses.map((c) => (
                      <Badge
                        key={c.id}
                        size="lg"
                        variant={c.id === selectedClassId ? 'filled' : 'light'}
                        color={c.id === selectedClassId ? 'indigo' : 'gray'}
                      >
                        {c.name}
                      </Badge>
                    ))}
                  </Group>
                  <Select
                    label="Select Class Form"
                    placeholder="Choose class"
                    data={myClasses.map((c) => ({ value: c.id, label: c.name }))}
                    value={selectedClassId || null}
                    onChange={(v) => setSelectedClassId(v || '')}
                    allowDeselect={false}
                  />
                </Stack>
              </Card>

              {selectedClassId && studentSections.length === 0 ? (
                <Card withBorder padding="lg"><Text c="dimmed">No sections/fields assigned for your class yet.</Text></Card>
              ) : (
                <Card withBorder padding="lg">
                  <Stack gap="lg">
                    <FieldRenderer sections={studentSections} values={fieldValues} onChange={handleFieldChange} />
                    <Group>
                      <Button loading={loading} onClick={saveData} leftSection={<IconDeviceFloppy size={16} />}>Save</Button>
                      <Button variant="light" color="gray" onClick={fetchAllData} leftSection={<IconRefresh size={16} />}>Refresh</Button>
                    </Group>
                  </Stack>
                </Card>
              )}
            </>
          )}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

export default StudentDashboard;
