import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Center,
  Card,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Alert,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user, profile, configError, authError } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile) {
      const roleRoutes = {
        org_admin: '/org',
        super_admin: '/super',
        faculty: '/faculty',
        student: '/student',
      };
      navigate(roleRoutes[profile.role] || '/', { replace: true });
    }
  }, [profile, navigate]);

  useEffect(() => {
    if (authError) {
      setError(authError);
      setLoading(false);
    }
    if (user && !profile && !authError) {
      setLoading(true);
      setError('');
    }
    if (!user) {
      setLoading(false);
    }
  }, [authError, profile, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(username, password);
    } catch (err) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <Center mih="100vh" p="md" bg="gray.1">
      <Card shadow="md" padding="xl" radius="md" withBorder w={400} maw="100%">
        <Stack align="center" gap={4} mb="lg">
          <Title order={2} c="indigo">StoreIt</Title>
          <Text c="dimmed" size="sm">Student Detail Management</Text>
        </Stack>

        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            {configError && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                {configError}
              </Alert>
            )}
            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                {error}
              </Alert>
            )}

            <TextInput
              label="Username or Email"
              placeholder="Enter your username or email"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              required
              autoComplete="username"
              disabled={Boolean(configError)}
            />

            <PasswordInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
              disabled={Boolean(configError)}
            />

            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={Boolean(configError)}
              mt="xs"
            >
              Sign In
            </Button>
          </Stack>
        </form>
      </Card>
    </Center>
  );
}
