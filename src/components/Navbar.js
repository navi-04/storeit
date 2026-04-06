import React from 'react';
import { Group, Text, Badge, Button } from '@mantine/core';
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
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  if (!user) return null;

  const roleLabel = ROLE_LABELS[profile?.role] || 'User';
  const displayName = profile?.username || profile?.full_name || user?.email || 'Account';

  return (
    <Group h="100%" px="md" justify="space-between">
      <Text fw={700} size="lg" c="white">
        StoreIt
      </Text>
      <Group gap="sm">
        <Badge variant="light" color="white" size="lg">
          {roleLabel}
        </Badge>
        <Text c="rgba(255,255,255,0.85)" size="sm" visibleFrom="sm">
          {displayName}
        </Text>
        <Button
          variant="light"
          color="red"
          size="xs"
          leftSection={<IconLogout size={16} />}
          onClick={handleLogout}
        >
          Logout
        </Button>
      </Group>
    </Group>
  );
}
