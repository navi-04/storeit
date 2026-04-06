import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  AppShell, Container, Title, Card, Text, Select, Button, Group,
  Stack, Table, Tabs, Loader, Center, Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconRefresh, IconDeviceFloppy, IconDownload } from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import FieldRenderer from '../components/FieldRenderer';

export function FacultyDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('my-details');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [myClasses, setMyClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  const [facultySections, setFacultySections] = useState([]);
  const [facultyFieldValues, setFacultyFieldValues] = useState({});

  const [studentSections, setStudentSections] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [studentSubmissions, setStudentSubmissions] = useState({});

  const fetchMyClasses = useCallback(async () => {
    if (!user?.id) return;
    const { data, error: err } = await supabase
      .from('class_faculty')
      .select('class_id, classes(id, name)')
      .eq('faculty_id', user.id);
    if (err) { setError(err.message); return; }
    setMyClasses((data || []).map((cf) => cf.classes).filter(Boolean));
  }, [user?.id]);

  useEffect(() => { fetchMyClasses(); }, [fetchMyClasses]);

  const fetchAllData = useCallback(async () => {
    if (!selectedClassId || !user?.id) return;
    setLoading(true);
    try {
      // faculty sections + my values
      const { data: secData } = await supabase
        .from('faculty_sections').select('*').eq('class_id', selectedClassId).order('section_order');
      const secs = secData || [];
      let fields = [];
      if (secs.length > 0) {
        const ids = secs.map((s) => s.id);
        const { data: fData } = await supabase
          .from('faculty_section_fields').select('*').in('section_id', ids).order('field_order');
        fields = fData || [];
      }
      const secsWithFields = secs.map((s) => ({ ...s, fields: fields.filter((f) => f.section_id === s.id) }));
      setFacultySections(secsWithFields);

      if (fields.length > 0) {
        const fieldIds = fields.map((f) => f.id);
        const { data: vals } = await supabase
          .from('faculty_field_values').select('*').in('field_id', fieldIds).eq('faculty_id', user.id);
        const valMap = {};
        (vals || []).forEach((v) => { valMap[v.field_id] = v.value; });
        setFacultyFieldValues(valMap);
      } else {
        setFacultyFieldValues({});
      }

      // student sections + student values (for "View Students" tab)
      const { data: stuSecData } = await supabase
        .from('student_sections').select('*').eq('class_id', selectedClassId).order('section_order');
      const stuSecs = stuSecData || [];
      let stuFields = [];
      if (stuSecs.length > 0) {
        const ids = stuSecs.map((s) => s.id);
        const { data: sfData } = await supabase
          .from('student_section_fields').select('*').in('section_id', ids).order('field_order');
        stuFields = sfData || [];
      }
      setStudentSections(stuSecs.map((s) => ({ ...s, fields: stuFields.filter((f) => f.section_id === s.id) })));

      const { data: csData } = await supabase
        .from('class_students').select('student_id, profiles(id, full_name, username)')
        .eq('class_id', selectedClassId);
      const stuList = (csData || []).map((cs) => cs.profiles).filter(Boolean);
      setClassStudents(stuList);

      let stuSubs = {};
      if (stuFields.length > 0) {
        const fieldIds = stuFields.map((f) => f.id);
        const { data: vals } = await supabase
          .from('student_field_values').select('*').in('field_id', fieldIds);
        (vals || []).forEach((v) => {
          if (!stuSubs[v.student_id]) stuSubs[v.student_id] = {};
          stuSubs[v.student_id][v.field_id] = v.value;
        });
      }
      setStudentSubmissions(stuSubs);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [selectedClassId, user?.id]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const handleFieldChange = (fieldId, value) => {
    setFacultyFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const saveFacultyData = async () => {
    setError(''); setLoading(true);
    try {
      const allFields = facultySections.flatMap((s) => s.fields);
      for (const field of allFields) {
        const value = facultyFieldValues[field.id] || '';
        const { data: existing } = await supabase
          .from('faculty_field_values').select('id').eq('field_id', field.id).eq('faculty_id', user.id).maybeSingle();
        if (existing) {
          const { error } = await supabase.from('faculty_field_values').update({ value }).eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('faculty_field_values').insert({ field_id: field.id, faculty_id: user.id, value });
          if (error) throw error;
        }
      }
      notifications.show({ message: 'Data saved!', color: 'green' });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const classSelectData = myClasses.map((c) => ({ value: c.id, label: c.name }));
  const allStudentFields = useMemo(() => studentSections.flatMap((s) => s.fields), [studentSections]);

  const exportStudentData = () => {
    if (allStudentFields.length === 0 || classStudents.length === 0) return;
    const rows = classStudents.map((student) => {
      const row = { 'Full Name': student.full_name, Username: student.username };
      allStudentFields.forEach((field) => {
        row[field.field_name] = studentSubmissions[student.id]?.[field.id] || '';
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    const selectedClass = myClasses.find((c) => c.id === selectedClassId);
    XLSX.utils.book_append_sheet(wb, ws, 'Student Submissions');
    XLSX.writeFile(wb, `student_submissions_${selectedClass?.name || 'class'}.xlsx`);
  };

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header bg="indigo.6"><Navbar /></AppShell.Header>
      <AppShell.Main>
        <Container size="lg" py="lg">
          <Title order={2} mb="lg">Faculty Dashboard</Title>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md" withCloseButton onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Select
            label="Select Class"
            placeholder="-- Select a class --"
            data={classSelectData}
            value={selectedClassId || null}
            onChange={(v) => setSelectedClassId(v || '')}
            mb="lg"
          />

          {!selectedClassId ? (
            <Card withBorder padding="lg"><Text c="dimmed">Please select a class above.</Text></Card>
          ) : loading ? (
            <Center py="xl"><Loader /></Center>
          ) : (
            <Tabs value={tab} onChange={setTab}>
              <Tabs.List>
                <Tabs.Tab value="my-details">My Details</Tabs.Tab>
                <Tabs.Tab value="view-students">View Students</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="my-details" pt="md">
                <Card withBorder padding="lg">
                  {facultySections.length === 0 ? (
                    <Text c="dimmed">No sections/fields assigned for this class yet.</Text>
                  ) : (
                    <Stack gap="lg">
                      <FieldRenderer sections={facultySections} values={facultyFieldValues} onChange={handleFieldChange} />
                      <Group>
                        <Button loading={loading} onClick={saveFacultyData} leftSection={<IconDeviceFloppy size={16} />}>Save</Button>
                        <Button variant="light" color="gray" onClick={fetchAllData} leftSection={<IconRefresh size={16} />}>Refresh</Button>
                      </Group>
                    </Stack>
                  )}
                </Card>
              </Tabs.Panel>

              <Tabs.Panel value="view-students" pt="md">
                <Card withBorder padding="lg">
                  <Group justify="space-between" mb="sm">
                    <Title order={4}>Student Submissions</Title>
                    {allStudentFields.length > 0 && classStudents.length > 0 && (
                      <Button size="xs" variant="light" onClick={exportStudentData} leftSection={<IconDownload size={14} />}>Export</Button>
                    )}
                  </Group>
                  {classStudents.length === 0 ? (
                    <Text c="dimmed">No students in this class.</Text>
                  ) : allStudentFields.length === 0 ? (
                    <Text c="dimmed">No student fields defined for this class.</Text>
                  ) : (
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Full Name</Table.Th>
                          <Table.Th>Username</Table.Th>
                          {allStudentFields.map((f) => <Table.Th key={f.id}>{f.field_name}</Table.Th>)}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {classStudents.map((s) => (
                          <Table.Tr key={s.id}>
                            <Table.Td>{s.full_name}</Table.Td>
                            <Table.Td>{s.username}</Table.Td>
                            {allStudentFields.map((f) => (
                              <Table.Td key={f.id}>{studentSubmissions[s.id]?.[f.id] || '-'}</Table.Td>
                            ))}
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  )}
                </Card>
              </Tabs.Panel>
            </Tabs>
          )}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

export default FacultyDashboard;
