import { Heading, Section, Text } from '@react-email/components';
import * as React from 'react';

import { Layout, type EmailContact } from './Layout';
import { colors, fonts } from './theme';

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

export interface BookingConfirmationFacts {
  reference: string;
  tourTitle: string;
  dateLabel: string;
  timeLabel: string;
  guestsLabel: string;
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

const greetingStyle: React.CSSProperties = {
  color: colors.ink,
  fontFamily: fonts.serif,
  fontSize: '26px',
  lineHeight: '32px',
  margin: '0 0 12px',
};

const paragraph: React.CSSProperties = {
  color: colors.inkSoft,
  fontFamily: fonts.sans,
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const card: React.CSSProperties = {
  backgroundColor: colors.cream,
  borderRadius: '12px',
  padding: '8px 20px',
  margin: '8px 0 24px',
};

const cardTitle: React.CSSProperties = {
  color: colors.navy,
  fontFamily: fonts.sans,
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  margin: '14px 0 6px',
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
  fontSize: '16px',
  fontWeight: 600,
  margin: '2px 0 12px',
};

const referenceValue: React.CSSProperties = {
  ...rowValue,
  color: colors.pinkDeep,
  fontWeight: 700,
  letterSpacing: '0.06em',
};

const sectionTitle: React.CSSProperties = {
  color: colors.navy,
  fontFamily: fonts.sans,
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  margin: '24px 0 8px',
};

const bullet: React.CSSProperties = {
  color: colors.inkSoft,
  fontFamily: fonts.sans,
  fontSize: '15px',
  lineHeight: '22px',
  margin: '0 0 6px',
  paddingLeft: '18px',
  textIndent: '-18px',
};

const signatureStyle: React.CSSProperties = {
  color: colors.ink,
  fontFamily: fonts.serif,
  fontSize: '18px',
  margin: '20px 0 0',
};

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
      <Text style={rowLabel}>{label}</Text>
      <Text style={valueStyle ?? rowValue}>{value}</Text>
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
      <Heading style={greetingStyle}>{copy.greeting}</Heading>
      <Text style={paragraph}>{copy.intro}</Text>

      <Section style={card}>
        <Text style={cardTitle}>{labels.detailsTitle}</Text>
        <DetailRow
          label={labels.reference}
          value={facts.reference}
          valueStyle={referenceValue}
        />
        <DetailRow label={labels.tour} value={facts.tourTitle} />
        <DetailRow label={labels.date} value={facts.dateLabel} />
        <DetailRow label={labels.time} value={facts.timeLabel} />
        <DetailRow label={labels.guests} value={facts.guestsLabel} />
        <DetailRow label={labels.total} value={facts.totalLabel} />
      </Section>

      {copy.goodToKnow.length > 0 ? (
        <>
          <Text style={sectionTitle}>{labels.goodToKnowTitle}</Text>
          {copy.goodToKnow.map((line, i) => (
            <Text key={i} style={bullet}>
              {'•  '}
              {line}
            </Text>
          ))}
        </>
      ) : null}

      {copy.meetingPoint ? (
        <>
          <Text style={sectionTitle}>{labels.meetingPointTitle}</Text>
          <Text style={paragraph}>{copy.meetingPoint}</Text>
        </>
      ) : null}

      {copy.closing ? <Text style={paragraph}>{copy.closing}</Text> : null}
      {copy.signature ? <Text style={signatureStyle}>{copy.signature}</Text> : null}
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
