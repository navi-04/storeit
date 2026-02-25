import React from 'react';
import { Group, Text, Badge, Button, AppShell } from '@mantine/core';
import { IconLogout } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ROLE_LABELS = {
  org_admin: 'Org Admin',
  super_admin: 'Super Admin',
  faculty: 'Faculty',
  student: 'Student',
};

export default function Navbar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  if (!profile) return null;

  return (
    <AppShell.Header>
      <Group h="100%" px="md" justify="space-between">
        <Text fw={700} size="lg" c="white">
          StoreIt
        </Text>
        <Group gap="sm">
          <Badge variant="light" color="white" size="lg">
            {ROLE_LABELS[profile.role]}
          </Badge>
          <Text c="rgba(255,255,255,0.85)" size="sm" visibleFrom="sm">
            {profile.username}
          </Text>
          <Button
            variant="subtle"
            color="white"
            size="xs"
            leftSection={<IconLogout size={16} />}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </Group>
      </Group>
    </AppShell.Header>
  );
}
