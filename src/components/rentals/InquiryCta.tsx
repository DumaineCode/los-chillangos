'use client';

import { useState } from 'react';

type Status = 'idle' | 'submitting' | 'success' | 'error';

type FieldErrors = {
  name?: boolean;
  email?: boolean;
  message?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InquiryCtaStrings = {
  heading: string;
  /**
   * Localized message pre-seeded into the textarea, already interpolated with
   * the bike name by the server parent (e.g. "I'm interested in renting the
   * Urban Cruiser bike."). Must be >=10 chars to satisfy the contact schema.
   */
  seededMessage: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  messageLabel: string;
  submit: string;
  sending: string;
  successTitle: string;
  successBody: string;
  sendAnother: string;
  errors: {
    name: string;
    email: string;
    message: string;
    unexpected: string;
  };
};

type Props = {
  /** Visitor locale, persisted with the inquiry (en | es). */
  locale: string;
  /** Bike slug carried into the contact message as `rental`. */
  rental: string;
  /**
   * Accessory ids the visitor is referencing. Optional and additive — when
   * empty the key is omitted from the payload (schema treats it as optional).
   */
  accessories?: string[];
  strings: InquiryCtaStrings;
};

/**
 * Rentals inquiry CTA (Client Component) — the Phase A → Phase B seam.
 *
 * Mirrors the public ContactForm: minimal name + email + message capture that
 * POSTs JSON to `/api/contact`. The message textarea is PRE-SEEDED with the
 * bike reference (>=10 chars so the schema's `message.min(10)` is satisfied
 * even if the visitor sends it untouched) and the payload carries the bike
 * `rental` slug plus any referenced `accessories` ids.
 *
 * The seam is deliberately engine-free: it only ever targets `/api/contact` —
 * no `/book`, fleet, availability, pricing math, or Stripe. Swapping in a
 * Phase B checkout happens here and nowhere else.
 *
 * Strings are passed as props from the server parent (which resolves the i18n
 * keys), so this component needs no NextIntlClientProvider context — matching
 * the ContactForm convention.
 */
export function InquiryCta({ locale, rental, accessories = [], strings: t }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState(t.seededMessage);
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate(): boolean {
    const next: FieldErrors = {
      name: name.trim().length < 2,
      email: !EMAIL_RE.test(email.trim()),
      message: message.trim().length < 10,
    };
    setErrors(next);
    return !next.name && !next.email && !next.message;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'submitting') return;
    if (!validate()) return;

    setStatus('submitting');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          locale: locale === 'es' ? 'es' : 'en',
          rental,
          // Optional and additive: only send when the visitor references at
          // least one accessory, so the empty case keeps the payload minimal.
          ...(accessories.length > 0 ? { accessories } : {}),
        }),
      });
      if (!res.ok) {
        setStatus('error');
        return;
      }
      setStatus('success');
      setName('');
      setEmail('');
      setMessage(t.seededMessage);
      setErrors({});
    } catch {
      setStatus('error');
    }
  }

  const errStyle: React.CSSProperties = {
    color: 'var(--terra)',
    fontSize: 12,
    marginTop: 4,
  };

  if (status === 'success') {
    return (
      <div className="inquiry-cta-success" data-testid="inquiry-cta" role="status">
        <p className="contact-success-title">{t.successTitle}</p>
        <p className="contact-success-body">{t.successBody}</p>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setStatus('idle')}
        >
          {t.sendAnother}
        </button>
      </div>
    );
  }

  return (
    <form className="inquiry-cta" data-testid="inquiry-cta" onSubmit={handleSubmit} noValidate>
      <h3 className="inquiry-cta-heading">{t.heading}</h3>

      <div className="field">
        <label htmlFor="inquiry-name">{t.nameLabel}</label>
        <input
          id="inquiry-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.namePlaceholder}
          autoComplete="name"
        />
        {errors.name ? (
          <span role="alert" style={errStyle}>
            {t.errors.name}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="inquiry-email">{t.emailLabel}</label>
        <input
          id="inquiry-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
          autoComplete="email"
        />
        {errors.email ? (
          <span role="alert" style={errStyle}>
            {t.errors.email}
          </span>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor="inquiry-message">{t.messageLabel}</label>
        <textarea
          id="inquiry-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
        />
        {errors.message ? (
          <span role="alert" style={errStyle}>
            {t.errors.message}
          </span>
        ) : null}
      </div>

      {status === 'error' ? (
        <p role="alert" className="inquiry-cta-error">
          {t.errors.unexpected}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn btn-primary btn-lg inquiry-submit"
        disabled={status === 'submitting'}
      >
        {status === 'submitting' ? t.sending : t.submit}
      </button>
    </form>
  );
}
