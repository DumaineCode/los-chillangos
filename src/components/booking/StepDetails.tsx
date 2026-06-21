'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { COUNTRIES } from '../../lib/booking/countries';

type Props = {
  name: string;
  email: string;
  whatsappOptional: string;
  country: string;
  locale: 'en' | 'es';
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onWhatsappChange: (v: string) => void;
  onCountryChange: (v: string) => void;
  errors: { name?: string | null; email?: string | null; whatsapp?: string | null; country?: string | null };
};

export function StepDetails({
  name,
  email,
  whatsappOptional,
  country,
  locale,
  onNameChange,
  onEmailChange,
  onWhatsappChange,
  onCountryChange,
  errors,
}: Props) {
  const t = useTranslations('booking.steps.details');
  const tErr = useTranslations('booking.errors');

  const sortedCountries = useMemo(
    () =>
      [...COUNTRIES].sort((a, b) => a[locale].localeCompare(b[locale], locale)),
    [locale],
  );

  const renderError = (key?: string | null) =>
    key ? (
      <span role="alert" style={{ color: 'var(--terra)', fontSize: 12, marginTop: 4 }}>
        {tErr(key.replace(/^errors\./, ''))}
      </span>
    ) : null;

  return (
    <div data-testid="booking-step-3">
      <h2>{t('title')}</h2>
      <p className="lede">{t('lede')}</p>
      <div className="field-grid" style={{ marginTop: 24 }}>
        <div className="field full">
          <label htmlFor="booking-name">{t('nameLabel')}</label>
          <input
            id="booking-name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t('namePlaceholder')}
            autoComplete="name"
          />
          {renderError(errors.name)}
        </div>
        <div className="field full">
          <label htmlFor="booking-email">{t('emailLabel')}</label>
          <input
            id="booking-email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder={t('emailPlaceholder')}
            autoComplete="email"
          />
          {renderError(errors.email)}
        </div>
        <div className="field full">
          <label htmlFor="booking-whatsapp">{t('whatsappLabel')}</label>
          <input
            id="booking-whatsapp"
            type="tel"
            value={whatsappOptional}
            onChange={(e) => onWhatsappChange(e.target.value)}
            placeholder={t('whatsappPlaceholder')}
            autoComplete="tel"
          />
          <small style={{ color: 'var(--ink-muted)', fontSize: 12, marginTop: 4 }}>
            {t('whatsappHint')}
          </small>
          {renderError(errors.whatsapp)}
        </div>
        <div className="field full">
          <label htmlFor="booking-country">{t('countryLabel')}</label>
          <select
            id="booking-country"
            value={country}
            onChange={(e) => onCountryChange(e.target.value)}
            autoComplete="country"
          >
            <option value="" disabled>
              {t('countryPlaceholder')}
            </option>
            {sortedCountries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c[locale]}
              </option>
            ))}
          </select>
          {renderError(errors.country)}
        </div>
      </div>
    </div>
  );
}
