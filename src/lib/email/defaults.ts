import type { EmailLocale } from './format';

/**
 * In-code fallback copy for the booking confirmation email, per locale.
 *
 * This is the safety net: any `email-content` global field left empty falls
 * back here, so a fresh install (or an untranslated locale) still sends a
 * correct, on-brand bilingual email with zero CMS configuration.
 *
 * `goodToKnow` is a newline-delimited string to mirror the CMS textarea shape,
 * so the send code has a single code path (`toLines`).
 *
 * Tokens: {name} (greeting), {tour} + {reference} (subject).
 */
export interface EmailCopy {
  subject: string;
  previewText: string;
  greeting: string;
  intro: string;
  goodToKnow: string;
  meetingPoint: string;
  closing: string;
  signature: string;
  footnote: string;
}

export const DEFAULT_EMAIL_COPY: Record<EmailLocale, EmailCopy> = {
  en: {
    subject: 'Your Los Chillangos booking is confirmed — {reference}',
    previewText: 'Payment received. Your spot is locked in — here are your details.',
    greeting: 'Hi {name},',
    intro:
      "Your payment went through and your spot is locked in. We can't wait to show you Mexico City! Here are your booking details:",
    goodToKnow:
      'Arrive 10 minutes early so we can get you set up.\nWear comfortable shoes and bring water and sunscreen.\nYour guide speaks both English and Spanish.',
    meetingPoint: '',
    closing: 'Questions before your tour? Just reply to this email — we’re happy to help.',
    signature: '— The Los Chillangos team',
    footnote: '',
  },
  es: {
    subject: 'Tu reserva con Los Chillangos está confirmada — {reference}',
    previewText: 'Recibimos tu pago. Tu lugar está apartado — aquí están tus datos.',
    greeting: 'Hola {name}:',
    intro:
      '¡Tu pago se procesó y tu lugar quedó apartado! Nos muere de ganas mostrarte la Ciudad de México. Aquí están los datos de tu reserva:',
    goodToKnow:
      'Llega 10 minutos antes para dejarte todo listo.\nUsa zapatos cómodos y trae agua y bloqueador.\nTu guía habla español e inglés.',
    meetingPoint: '',
    closing: '¿Dudas antes del tour? Responde este correo y con gusto te ayudamos.',
    signature: '— El equipo de Los Chillangos',
    footnote: '',
  },
};
