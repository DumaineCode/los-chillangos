import { Heading, Section, Text } from '@react-email/components';
import * as React from 'react';

import { Layout, type EmailContact } from './Layout';
import { styles } from './theme';

export interface BookingConfirmationCopy {
  greeting: string;
  intro: string;
  goodToKnow: string[];
  meetingPoint?: string | null;
  closing?: string | null;
  signature?: string | null;
}

export interface BookingConfirmationLabels {
  detailsTitle: string;
  goodToKnowTitle: string;
  meetingPointTitle: string;
  reference: string;
  tour: string;
  date: string;
  time: string;
  guests: string;
  total: string;
}

/** A single selected extra, itemized in the confirmation email. */
export interface BookingConfirmationExtra {
  name: string;
  /** Pre-formatted amount, e.g. "+$140.00". */
  amountLabel: string;
}

export interface BookingConfirmationFacts {
  reference: string;
  tourTitle: string;
  dateLabel: string;
  timeLabel: string;
  guestsLabel: string;
  /** Selected extras, itemized between guests and the total. Empty when none. */
  extras?: BookingConfirmationExtra[];
  totalLabel: string;
}

export interface BookingConfirmationProps {
  previewText: string;
  copy: BookingConfirmationCopy;
  labels: BookingConfirmationLabels;
  facts: BookingConfirmationFacts;
  logoUrl?: string | null;
  contact?: EmailContact | null;
  footnote?: string | null;
}

function DetailRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
}): React.ReactElement {
  return (
    <>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={valueStyle ?? styles.rowValue}>{value}</Text>
    </>
  );
}

export function BookingConfirmation({
  previewText,
  copy,
  labels,
  facts,
  logoUrl,
  contact,
  footnote,
}: BookingConfirmationProps): React.ReactElement {
  return (
    <Layout
      previewText={previewText}
      logoUrl={logoUrl}
      contact={contact}
      footnote={footnote}
    >
      <Heading style={styles.heading}>{copy.greeting}</Heading>
      <Text style={styles.paragraph}>{copy.intro}</Text>

      <Section style={styles.card}>
        <Text style={styles.cardTitle}>{labels.detailsTitle}</Text>
        <DetailRow
          label={labels.reference}
          value={facts.reference}
          valueStyle={styles.badge}
        />
        <DetailRow label={labels.tour} value={facts.tourTitle} />
        <DetailRow label={labels.date} value={facts.dateLabel} />
        <DetailRow label={labels.time} value={facts.timeLabel} />
        <DetailRow label={labels.guests} value={facts.guestsLabel} />
        {(facts.extras ?? []).map((extra, i) => (
          <DetailRow key={i} label={extra.name} value={extra.amountLabel} />
        ))}
        <DetailRow label={labels.total} value={facts.totalLabel} />
      </Section>

      {copy.goodToKnow.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>{labels.goodToKnowTitle}</Text>
          {copy.goodToKnow.map((line, i) => (
            <Text key={i} style={styles.bullet}>
              {'•  '}
              {line}
            </Text>
          ))}
        </>
      ) : null}

      {copy.meetingPoint ? (
        <>
          <Text style={styles.sectionTitle}>{labels.meetingPointTitle}</Text>
          <Text style={styles.paragraph}>{copy.meetingPoint}</Text>
        </>
      ) : null}

      {copy.closing ? <Text style={styles.paragraph}>{copy.closing}</Text> : null}
      {copy.signature ? <Text style={styles.signature}>{copy.signature}</Text> : null}
    </Layout>
  );
}

BookingConfirmation.PreviewProps = {
  previewText: 'Your Los Chillangos booking is confirmed — LC-7QK2P9XZ',
  copy: {
    greeting: 'Hi María,',
    intro:
      "Your payment went through and your spot is locked in. We can't wait to ride with you through Mexico City!",
    goodToKnow: [
      'Arrive 10 minutes early so we can fit your helmet and e-bike.',
      'Wear comfortable shoes and bring water + sunscreen.',
      'Your guide speaks both English and Spanish.',
    ],
    meetingPoint: 'Av. Álvaro Obregón 100, Roma Norte — look for the orange Los Chillangos flag.',
    closing: 'Questions before the ride? Just reply to this email.',
    signature: '— The Los Chillangos team',
  },
  labels: {
    detailsTitle: 'Your booking',
    goodToKnowTitle: 'Good to know',
    meetingPointTitle: 'Meeting point',
    reference: 'Reference',
    tour: 'Tour',
    date: 'Date',
    time: 'Time',
    guests: 'Guests',
    total: 'Total paid',
  },
  facts: {
    reference: 'LC-7QK2P9XZ',
    tourTitle: 'Centro Histórico E-Bike Tour',
    dateLabel: 'Saturday, March 14, 2026',
    timeLabel: '9:00 AM',
    guestsLabel: '2 adults · 1 teen',
    extras: [{ name: 'Private tour', amountLabel: '+$140.00' }],
    totalLabel: '$225.00',
  },
  contact: {
    email: 'hola@loschillangos.com',
    whatsapp: '+52 55 1234 5678',
    address: 'Roma Norte, Ciudad de México',
    addressLabel: 'Studio',
  },
  footnote: 'Free cancellation up to 48 hours before your tour. Reference required for any change.',
} satisfies BookingConfirmationProps;

export default BookingConfirmation;
