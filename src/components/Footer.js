import React from 'react';
import { Group, Text, Anchor, Divider, Container } from '@mantine/core';

const Footer = () => {
  return (
    <>
      <Divider my="xl" />
      <Container size="lg" pb="xl">
        <Group justify="space-between" wrap="wrap">
          <Text size="sm" c="dimmed">
            &copy; {new Date().getFullYear()}{' '}
            <Anchor href="https://fewinfos.com" target="_blank" rel="noopener noreferrer" size="sm">
              fewinfos
            </Anchor>
            . All rights reserved.
          </Text>
          <Text size="sm" c="dimmed">
            Developed by{' '}
            <Anchor href="https://github.com/navi-04" target="_blank" rel="noopener noreferrer" size="sm">
              navi-04
            </Anchor>
          </Text>
        </Group>
      </Container>
    </>
  );
};

export default Footer;
