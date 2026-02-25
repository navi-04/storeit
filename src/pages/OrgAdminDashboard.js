import React, { useState, useEffect } from 'react';
import {
  AppShell,
  Container,
  Title,
  Card,
  TextInput,
  PasswordInput,
  Select,
  Button,
  Group,
  Stack,
  Table,
  Alert,
  Modal,
  Text,
  ActionIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconCheck,
  IconTrash,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { supabase, supabaseAdmin } from '../supabaseClient';
import { usernameToEmail } from '../utils/authEmail';
import Navbar from '../components/Navbar';

export default function OrgAdminDashboard() {
  const [departments, setDepartments] = useState([]);
  const [deptName, setDeptName] = useState('');
  const [deptLoading, setDeptLoading] = useState(false);

  const [superAdmins, setSuperAdmins] = useState([]);
  const [saForm, setSaForm] = useState({ username: '', password: '', full_name: '', department_id: '' });
  const [saLoading, setSaLoading] = useState(false);

  const [createdSuperAdmins, setCreatedSuperAdmins] = useState({});
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [editingSuperAdmin, setEditingSuperAdmin] = useState(null);
  const [visiblePasswords, setVisiblePasswords] = useState({});

  const [error, setError] = useState('');

  const togglePasswordVisibility = (userId) => {
    setVisiblePasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  useEffect(() => {
    loadDepartments();
    loadSuperAdmins();
  }, []);

  const loadDepartments = async () => {
    const { data, error } = await supabase.from('departments').select('*').order('created_at');
    if (error) { setError(error.message); return; }
    setDepartments(data || []);
  };

  const loadSuperAdmins = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, departments(name)')
      .eq('role', 'super_admin')
      .order('created_at');
    if (error) { setError(error.message); return; }
    setSuperAdmins(data || []);
  };

  const createDepartment = async (e) => {
    e.preventDefault();
    if (!deptName.trim()) return;
    setDeptLoading(true); setError('');
    const { error } = await supabase.from('departments').insert({ name: deptName.trim() });
    if (error) { setError(error.message); }
    else {
      notifications.show({ title: 'Success', message: 'Department created!', color: 'green', icon: <IconCheck size={16} /> });
      setDeptName('');
      loadDepartments();
    }
    setDeptLoading(false);
  };

  const deleteDepartment = async (id) => {
    if (!window.confirm('Delete this department? All related data will be permanently deleted.')) return;
    setError('');
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) { setError(error.message); return; }
    notifications.show({ title: 'Deleted', message: 'Department deleted!', color: 'green' });
    loadDepartments();
    loadSuperAdmins();
  };

  const updateDepartment = async (e) => {
    e.preventDefault();
    if (!editingDepartment?.name.trim()) return;
    setDeptLoading(true); setError('');
    try {
      const { error } = await supabase.from('departments').update({ name: editingDepartment.name.trim() }).eq('id', editingDepartment.id);
      if (error) throw error;
      notifications.show({ title: 'Updated', message: 'Department updated!', color: 'green' });
      setEditingDepartment(null);
      loadDepartments();
    } catch (err) { setError(err.message); }
    setDeptLoading(false);
  };

  const createSuperAdmin = async (e) => {
    e.preventDefault();
    if (!saForm.username || !saForm.password || !saForm.department_id) {
      setError('All fields required for Super Admin');
      return;
    }
    setSaLoading(true); setError('');
    try {
      const fakeEmail = usernameToEmail(saForm.username);
      const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
        email: fakeEmail,
        password: saForm.password,
        options: {
          data: { full_name: saForm.full_name, role: 'super_admin', username: saForm.username.trim() },
        },
      });
      if (signUpError) throw signUpError;

      if (signUpData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            role: 'super_admin',
            department_id: saForm.department_id,
            full_name: saForm.full_name,
            username: saForm.username.trim(),
            password: saForm.password,
          })
          .eq('id', signUpData.user.id);
        if (profileError) throw profileError;
        setCreatedSuperAdmins((prev) => ({ ...prev, [signUpData.user.id]: { username: saForm.username, password: saForm.password } }));
        setVisiblePasswords((prev) => ({ ...prev, [signUpData.user.id]: true }));
      }

      notifications.show({ title: 'Success', message: 'Super Admin created!', color: 'green', icon: <IconCheck size={16} /> });
      setSaForm({ username: '', password: '', full_name: '', department_id: '' });
      loadSuperAdmins();
    } catch (err) { setError(err.message); }
    setSaLoading(false);
  };

  const deleteSuperAdmin = async (id, username) => {
    if (!window.confirm(`Delete super admin "${username}"?`)) return;
    setError('');
    try {
      const { error } = await supabase.rpc('delete_auth_user', { target_user_id: id });
      if (error) throw error;
      setCreatedSuperAdmins((prev) => { const n = { ...prev }; delete n[id]; return n; });
      notifications.show({ title: 'Deleted', message: 'Super Admin deleted!', color: 'green' });
      loadSuperAdmins();
    } catch (err) { setError(err.message); }
  };

  const updateSuperAdmin = async (e) => {
    e.preventDefault();
    setSaLoading(true); setError('');
    try {
      const { error } = await supabase.from('profiles')
        .update({ full_name: editingSuperAdmin.full_name, username: editingSuperAdmin.username, department_id: editingSuperAdmin.department_id })
        .eq('id', editingSuperAdmin.id);
      if (error) throw error;
      notifications.show({ title: 'Updated', message: 'Super Admin updated!', color: 'green' });
      setEditingSuperAdmin(null);
      loadSuperAdmins();
    } catch (err) { setError(err.message); }
    setSaLoading(false);
  };

  const clearDatabase = async () => {
    const confirmText = 'DELETE EVERYTHING';
    const userInput = window.prompt(`WARNING: This will permanently delete ALL data!\nType "${confirmText}" to confirm:`);
    if (userInput !== confirmText) {
      if (userInput !== null) setError('Cancelled — text did not match.');
      return;
    }
    setError('');
    setDeptLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Delete all auth users except current user (profiles cascade via FK)
      const { data: allProfiles } = await supabase.from('profiles').select('id').neq('id', user.id);
      for (const p of (allProfiles || [])) {
        await supabase.rpc('delete_auth_user', { target_user_id: p.id });
      }

      // Delete all departments (classes etc. cascade)
      const { error: deptError } = await supabase.from('departments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (deptError) throw deptError;
      notifications.show({ title: 'Cleared', message: 'All data deleted except your account.', color: 'green', icon: <IconCheck size={16} /> });
      loadDepartments();
      loadSuperAdmins();
    } catch (err) { setError(`Failed: ${err.message}`); }
    finally { setDeptLoading(false); }
  };

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header bg="indigo.6">
        <Navbar />
      </AppShell.Header>
      <AppShell.Main>
        <Container size="md" py="lg">
          <Title order={2} mb="lg">Org Admin Dashboard</Title>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md" withCloseButton onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* Create Department */}
          <Card withBorder shadow="sm" padding="lg" mb="lg">
            <Title order={4} mb="sm">Create Department</Title>
            <form onSubmit={createDepartment}>
              <Group>
                <TextInput placeholder="Department Name" value={deptName} onChange={(e) => setDeptName(e.currentTarget.value)} style={{ flex: 1 }} />
                <Button type="submit" loading={deptLoading}>Create</Button>
              </Group>
            </form>
            <Title order={5} mt="lg" mb="xs">Existing Departments ({departments.length})</Title>
            {departments.length === 0 ? <Text c="dimmed">No departments yet.</Text> : (
              <Table striped highlightOnHover>
                <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Created</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {departments.map((d) => (
                    <Table.Tr key={d.id}>
                      <Table.Td>{d.name}</Table.Td>
                      <Table.Td>{new Date(d.created_at).toLocaleDateString()}</Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon variant="light" color="indigo" onClick={() => setEditingDepartment(d)}><IconEdit size={16} /></ActionIcon>
                          <ActionIcon variant="light" color="red" onClick={() => deleteDepartment(d.id)}><IconTrash size={16} /></ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>

          {/* Create Super Admin */}
          <Card withBorder shadow="sm" padding="lg" mb="lg">
            <Title order={4} mb="sm">Create Super Admin</Title>
            <form onSubmit={createSuperAdmin}>
              <Stack gap="sm">
                <TextInput label="Full Name" value={saForm.full_name} onChange={(e) => setSaForm({ ...saForm, full_name: e.currentTarget.value })} placeholder="Full Name" />
                <TextInput label="Username" value={saForm.username} onChange={(e) => setSaForm({ ...saForm, username: e.currentTarget.value })} placeholder="Username (used for login)" required />
                <PasswordInput label="Password" value={saForm.password} onChange={(e) => setSaForm({ ...saForm, password: e.currentTarget.value })} placeholder="Min 6 characters" required />
                <Select label="Department" placeholder="-- Select Department --" data={departments.map((d) => ({ value: d.id, label: d.name }))} value={saForm.department_id || null} onChange={(v) => setSaForm({ ...saForm, department_id: v || '' })} required />
                <Button type="submit" loading={saLoading}>Create Super Admin</Button>
              </Stack>
            </form>
            <Title order={5} mt="lg" mb="xs">Existing Super Admins ({superAdmins.length})</Title>
            {superAdmins.length === 0 ? <Text c="dimmed">No super admins yet.</Text> : (
              <Table striped highlightOnHover>
                <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Username</Table.Th><Table.Th>Password</Table.Th><Table.Th>Department</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {superAdmins.map((sa) => (
                    <Table.Tr key={sa.id}>
                      <Table.Td>{sa.full_name}</Table.Td>
                      <Table.Td>{sa.username}</Table.Td>
                      <Table.Td>
                        {sa.password || createdSuperAdmins[sa.id] ? (
                          <Group gap="xs">
                            <Text size="sm" ff="monospace" c="teal" fw={600}>
                              {visiblePasswords[sa.id] ? (sa.password || createdSuperAdmins[sa.id]?.password) : '••••••••'}
                            </Text>
                            <ActionIcon variant="subtle" size="sm" onClick={() => togglePasswordVisibility(sa.id)}>
                              {visiblePasswords[sa.id] ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                            </ActionIcon>
                          </Group>
                        ) : <Text c="dimmed" size="sm">••••••••</Text>}
                      </Table.Td>
                      <Table.Td>{sa.departments?.name || '—'}</Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <ActionIcon variant="light" color="indigo" onClick={() => setEditingSuperAdmin(sa)}><IconEdit size={16} /></ActionIcon>
                          <ActionIcon variant="light" color="red" onClick={() => deleteSuperAdmin(sa.id, sa.username)}><IconTrash size={16} /></ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>

          {/* Danger Zone */}
          <Card withBorder shadow="sm" padding="lg" mb="lg" style={{ borderColor: 'var(--mantine-color-red-5)', borderWidth: 2 }}>
            <Group gap="xs" mb="md">
              <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
              <Title order={4} c="red">Danger Zone</Title>
            </Group>
            <Alert color="yellow" variant="light" mb="md">
              <Text fw={600} mb={4}>Clear All Database</Text>
              <Text size="sm">
                This will permanently delete <b>ALL</b> data including departments, users, classes, forms, and submissions. Only your org admin account will be preserved.
              </Text>
            </Alert>
            <Button color="red" onClick={clearDatabase} loading={deptLoading} leftSection={<IconTrash size={16} />}>
              Clear All Database
            </Button>
          </Card>
        </Container>
      </AppShell.Main>

      {/* Edit Department Modal */}
      <Modal opened={!!editingDepartment} onClose={() => setEditingDepartment(null)} title="Edit Department">
        <form onSubmit={updateDepartment}>
          <Stack gap="sm">
            <TextInput label="Department Name" value={editingDepartment?.name || ''} onChange={(e) => setEditingDepartment({ ...editingDepartment, name: e.currentTarget.value })} required />
            <Group><Button type="submit" loading={deptLoading}>Update</Button><Button variant="light" color="gray" onClick={() => setEditingDepartment(null)}>Cancel</Button></Group>
          </Stack>
        </form>
      </Modal>

      {/* Edit Super Admin Modal */}
      <Modal opened={!!editingSuperAdmin} onClose={() => setEditingSuperAdmin(null)} title="Edit Super Admin">
        <form onSubmit={updateSuperAdmin}>
          <Stack gap="sm">
            <TextInput label="Full Name" value={editingSuperAdmin?.full_name || ''} onChange={(e) => setEditingSuperAdmin({ ...editingSuperAdmin, full_name: e.currentTarget.value })} required />
            <TextInput label="Username" value={editingSuperAdmin?.username || ''} onChange={(e) => setEditingSuperAdmin({ ...editingSuperAdmin, username: e.currentTarget.value })} required />
            <Select label="Department" data={departments.map((d) => ({ value: d.id, label: d.name }))} value={editingSuperAdmin?.department_id || null} onChange={(v) => setEditingSuperAdmin({ ...editingSuperAdmin, department_id: v || '' })} required />
            <Group><Button type="submit" loading={saLoading}>Update</Button><Button variant="light" color="gray" onClick={() => setEditingSuperAdmin(null)}>Cancel</Button></Group>
          </Stack>
        </form>
      </Modal>
    </AppShell>
  );
}
