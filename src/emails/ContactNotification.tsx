import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';

import { Layout } from './Layout';
import { colors, fonts } from './theme';

export interface ContactNotificationProps {
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  locale: string;
  /** Deep link to the message in the Payload admin (omitted if unknown). */
  adminUrl?: string | null;
}

const heading: React.CSSProperties = {
  color: colors.ink,
  fontFamily: fonts.serif,
  fontSize: '24px',
  margin: '0 0 4px',
};

const subtle: React.CSSProperties = {
  color: colors.inkMuted,
  fontFamily: fonts.sans,
  fontSize: '14px',
  margin: '0 0 20px',
};

const card: React.CSSProperties = {
  backgroundColor: colors.cream,
  borderRadius: '12px',
  padding: '8px 20px',
  margin: '0 0 20px',
};

const rowLabel: React.CSSProperties = {
  color: colors.inkMuted,
  fontFamily: fonts.sans,
  fontSize: '12px',
  letterSpacing: '0.04em',
  margin: '12px 0 0',
  textTransform: 'uppercase',
};

const rowValue: React.CSSProperties = {
  color: colors.ink,
  fontFamily: fonts.sans,
  fontSize: '15px',
  fontWeight: 600,
  margin: '2px 0 12px',
};

const messageText: React.CSSProperties = {
  color: colors.ink,
  fontFamily: fonts.sans,
  fontSize: '15px',
  lineHeight: '24px',
  margin: '2px 0 12px',
  whiteSpace: 'pre-wrap',
};

const button: React.CSSProperties = {
  backgroundColor: colors.navy,
  borderRadius: '10px',
  color: colors.cream,
  fontFamily: fonts.sans,
  fontSize: '14px',
  fontWeight: 700,
  padding: '12px 22px',
  textDecoration: 'none',
};

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <>
      <Text style={rowLabel}>{label}</Text>
      <Text style={rowValue}>{value}</Text>
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
      <Heading style={heading}>New contact message</Heading>
      <Text style={subtle}>Someone reached out through the contact form.</Text>

      <Section style={card}>
        <Row label="Name" value={name} />
        <Row label="Email" value={email} />
        {phone ? <Row label="Phone" value={phone} /> : null}
        <Row label="Language" value={locale.toUpperCase()} />
      </Section>

      <Section style={card}>
        <Text style={rowLabel}>Message</Text>
        <Text style={messageText}>{message}</Text>
      </Section>

      {adminUrl ? (
        <Section style={{ textAlign: 'center', margin: '8px 0 4px' }}>
          <Button href={adminUrl} style={button}>
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
