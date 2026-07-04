import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';

import { Layout } from './Layout';
import { styles } from './theme';

export interface ContactNotificationProps {
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  locale: string;
  /** Deep link to the message in the Payload admin (omitted if unknown). */
  adminUrl?: string | null;
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </>
  );
}

export function ContactNotification({
  name,
  email,
  phone,
  message,
  locale,
  adminUrl,
}: ContactNotificationProps): React.ReactElement {
  return (
    <Layout previewText={`New contact message — ${name}`}>
      <Heading style={styles.heading}>New contact message</Heading>
      <Text style={styles.subtle}>Someone reached out through the contact form.</Text>

      <Section style={styles.card}>
        <Row label="Name" value={name} />
        <Row label="Email" value={email} />
        {phone ? <Row label="Phone" value={phone} /> : null}
        <Row label="Language" value={locale.toUpperCase()} />
      </Section>

      <Section style={styles.card}>
        <Text style={styles.rowLabel}>Message</Text>
        <Text style={styles.message}>{message}</Text>
      </Section>

      {adminUrl ? (
        <Section style={{ textAlign: 'center', margin: '8px 0 4px' }}>
          <Button href={adminUrl} style={styles.button}>
            Open in admin
          </Button>
        </Section>
      ) : null}
    </Layout>
  );
}

ContactNotification.PreviewProps = {
  name: 'María González',
  email: 'maria@example.com',
  phone: '+52 55 1234 5678',
  message: 'Hola, me gustaría saber si pueden organizar un tour privado para un grupo de 6 personas el próximo fin de semana. ¡Gracias!',
  locale: 'es',
  adminUrl: 'https://loschillangos.com/admin/collections/contact-messages/12',
} satisfies ContactNotificationProps;

export default ContactNotification;
