import {
  Body,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

import { colors, fonts } from './theme';

export interface EmailContact {
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  addressLabel?: string | null;
}

export interface LayoutProps {
  /** Inbox preview snippet (hidden in the body). */
  previewText: string;
  /** Optional brand logo (absolute URL). Falls back to the wordmark. */
  logoUrl?: string | null;
  /** Wordmark shown when no logo is provided. */
  brandName?: string;
  /** Footer contact channels. */
  contact?: EmailContact | null;
  /** Small print under the footer (e.g. cancellation policy line). */
  footnote?: string | null;
  children: React.ReactNode;
}

const main: React.CSSProperties = {
  backgroundColor: colors.bg,
  fontFamily: fonts.sans,
  margin: 0,
  padding: '32px 12px',
};

const container: React.CSSProperties = {
  backgroundColor: colors.white,
  border: `1px solid ${colors.line}`,
  borderRadius: '16px',
  margin: '0 auto',
  maxWidth: '600px',
  overflow: 'hidden',
};

const header: React.CSSProperties = {
  backgroundColor: colors.navy,
  padding: '28px 32px',
  textAlign: 'center',
};

const wordmark: React.CSSProperties = {
  color: colors.cream,
  fontFamily: fonts.sans,
  fontSize: '20px',
  fontWeight: 700,
  letterSpacing: '0.18em',
  margin: 0,
  textTransform: 'uppercase',
};

const content: React.CSSProperties = {
  padding: '32px',
};

const footer: React.CSSProperties = {
  padding: '0 32px 32px',
};

const footerText: React.CSSProperties = {
  color: colors.inkMuted,
  fontFamily: fonts.sans,
  fontSize: '13px',
  lineHeight: '20px',
  margin: '2px 0',
};

const footnoteText: React.CSSProperties = {
  color: colors.inkMuted,
  fontFamily: fonts.sans,
  fontSize: '12px',
  lineHeight: '18px',
  margin: '14px 0 0',
};

const footerLink: React.CSSProperties = {
  color: colors.pinkDeep,
  textDecoration: 'none',
};

export function Layout({
  previewText,
  logoUrl,
  brandName = 'Los Chillangos',
  contact,
  footnote,
  children,
}: LayoutProps): React.ReactElement {
  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="DM Sans"
          fallbackFontFamily="Helvetica"
          webFont={{
            url: 'https://fonts.gstatic.com/s/dmsans/v15/rP2tp2ywxg089UriI5-g4vlH9VoD8CmcqZG40F9JadbnoEwAopxhTmf3ZGMZpg.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="Instrument Serif"
          fallbackFontFamily="Georgia"
          webFont={{
            url: 'https://fonts.gstatic.com/s/instrumentserif/v4/jizBRFtNs2ka5fXjeivQ4LroWlx-2zIZj1bIkNo.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            {logoUrl ? (
              <Img
                src={logoUrl}
                alt={brandName}
                height={40}
                style={{ margin: '0 auto', display: 'block' }}
              />
            ) : (
              <Text style={wordmark}>{brandName}</Text>
            )}
          </Section>

          <Section style={content}>{children}</Section>

          <Hr style={{ borderColor: colors.line, margin: '0 32px 20px' }} />
          <Section style={footer}>
            {contact?.addressLabel || contact?.address ? (
              <Text style={footerText}>
                {contact?.addressLabel ? `${contact.addressLabel} · ` : ''}
                {contact?.address ?? ''}
              </Text>
            ) : null}
            {contact?.email ? (
              <Text style={footerText}>
                <Link href={`mailto:${contact.email}`} style={footerLink}>
                  {contact.email}
                </Link>
              </Text>
            ) : null}
            {contact?.whatsapp ? (
              <Text style={footerText}>WhatsApp: {contact.whatsapp}</Text>
            ) : null}
            {footnote ? <Text style={footnoteText}>{footnote}</Text> : null}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default Layout;
