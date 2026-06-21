'use client';

import { useState } from 'react';

type Status = 'idle' | 'submitting' | 'success' | 'error';

type FieldErrors = {
  name?: boolean;
  email?: boolean;
  message?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ContactFormStrings = {
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
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
  locale: string;
  strings: ContactFormStrings;
};

/**
 * Public contact form (Client Component).
 *
 * Minimal by design — name, email, message + an optional phone. POSTs JSON to
 * `/api/contact`, which stores a `contact-messages` row and emails the owner.
 *
 * Strings are passed as props from the parent server component so this
 * component does not need NextIntlClientProvider context at all.
 */
export function ContactForm({ locale, strings: t }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
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
          phone: phone.trim(),
          message: message.trim(),
          locale: locale === 'es' ? 'es' : 'en',
        }),
      });
      if (!res.ok) {
        setStatus('error');
        return;
      }
      setStatus('success');
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
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
      <div className="contact-form-success" role="status">
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
    <form className="contact-form" onSubmit={handleSubmit} noValidate>
      <div className="field-grid">
        <div className="field full">
          <label htmlFor="contact-name">{t.nameLabel}</label>
          <input
            id="contact-name"
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
          <label htmlFor="contact-email">{t.emailLabel}</label>
          <input
            id="contact-email"
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
          <label htmlFor="contact-phone">{t.phoneLabel}</label>
          <input
            id="contact-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.phonePlaceholder}
            autoComplete="tel"
          />
        </div>

        <div className="field full">
          <label htmlFor="contact-message">{t.messageLabel}</label>
          <textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t.messagePlaceholder}
            rows={5}
          />
          {errors.message ? (
            <span role="alert" style={errStyle}>
              {t.errors.message}
            </span>
          ) : null}
        </div>
      </div>

      {status === 'error' ? (
        <p role="alert" className="contact-form-error">
          {t.errors.unexpected}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn btn-primary btn-lg contact-submit"
        disabled={status === 'submitting'}
      >
        {status === 'submitting' ? t.sending : t.submit}
      </button>
    </form>
  );
}
