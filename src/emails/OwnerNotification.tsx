import { Button, Heading, Section, Text } from '@react-email/components';
import * as React from 'react';

import { Layout } from './Layout';
import { styles } from './theme';

export interface OwnerNotificationProps {
  reference: string;
  tourTitle: string;
  dateLabel: string;
  timeLabel: string;
  guestsLabel: string;
  totalLabel: string;
  customer: {
    name: string;
    email: string;
    whatsapp?: string | null;
    country?: string | null;
    locale: string;
  };
  /** Deep link to the booking in the Payload admin (omitted if unknown). */
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

export function OwnerNotification({
  reference,
  tourTitle,
  dateLabel,
  timeLabel,
  guestsLabel,
  totalLabel,
  customer,
  adminUrl,
}: OwnerNotificationProps): React.ReactElement {
  return (
    <Layout previewText={`New paid booking — ${reference} · ${tourTitle}`}>
      <Heading style={styles.heading}>New paid booking</Heading>
      <Text style={styles.subtle}>A guest just completed payment. Details below.</Text>

      <Section style={styles.card}>
        <Row label="Reference" value={reference} />
        <Row label="Tour" value={tourTitle} />
        <Row label="Date" value={dateLabel} />
        <Row label="Time" value={timeLabel} />
        <Row label="Guests" value={guestsLabel} />
        <Row label="Total paid" value={totalLabel} />
      </Section>

      <Section style={styles.card}>
        <Row label="Customer" value={customer.name} />
        <Row label="Email" value={customer.email} />
        {customer.whatsapp ? <Row label="WhatsApp" value={customer.whatsapp} /> : null}
        {customer.country ? <Row label="Country" value={customer.country} /> : null}
        <Row label="Language" value={customer.locale.toUpperCase()} />
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

OwnerNotification.PreviewProps = {
  reference: 'LC-7QK2P9XZ',
  tourTitle: 'Centro Histórico E-Bike Tour',
  dateLabel: 'Saturday, March 14, 2026',
  timeLabel: '9:00 AM',
  guestsLabel: '2 adults · 1 teen',
  totalLabel: '$225.00',
  customer: {
    name: 'María González',
    email: 'maria@example.com',
    whatsapp: '+52 55 1234 5678',
    locale: 'es',
  },
  adminUrl: 'https://loschillangos.com/admin/collections/bookings/42',
} satisfies OwnerNotificationProps;

export default OwnerNotification;
