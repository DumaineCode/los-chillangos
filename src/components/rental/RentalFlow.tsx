'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { TOUR_TIMEZONE } from '../../lib/booking/availability';
import { stepDetailsSchema } from '../../lib/booking/schema';
import { MiniCalendar } from '../booking/MiniCalendar';
import { StepDetails } from '../booking/StepDetails';
import { formatDurationLabel } from './duration';
import { RentalOptions, type RentalCombo } from './RentalOptions';

type Props = {
  siteUrl: string;
  locale: 'en' | 'es';
};

type StepKey = 1 | 2 | 3 | 4;
const TOTAL_STEPS = 4;

type AvailabilityResponse = {
  date: string;
  rentable: boolean;
  combos: RentalCombo[];
};

/**
 * Standalone bike-rental wizard (Batch 3c / PR4). Mirrors the tour `BookingFlow`
 * four-step shape (date → options → details → confirm) and reuses its calendar
 * and details primitives.
 *
 * The calendar only enables the days a rental can EVER fall on (today +
 * tomorrow); the authoritative rentable/closed decision and the start×tier grid
 * are driven entirely by GET /api/rental/availability — the client does not
 * re-implement the §5 cutoff beyond enabling/disabling those two days. The
 * confirm step POSTs to /api/rental/checkout and NEVER sends a price; the server
 * derives `unitPrice`/`totalAmount` from settings.
 */
export function RentalFlow({ locale }: Props) {
  const t = useTranslations('rentals.flow');
  const tButtons = useTranslations('booking.buttons');

  const [step, setStep] = useState<StepKey>(1);
  const [date, setDate] = useState<Date | null>(null);
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappOptional, setWhatsappOptional] = useState('');
  const [country, setCountry] = useState('');

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const [dateError, setDateError] = useState<string | null>(null);
  const [optionError, setOptionError] = useState<string | null>(null);
  const [detailErrors, setDetailErrors] = useState<{
    name?: string | null;
    email?: string | null;
    whatsapp?: string | null;
    country?: string | null;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch the advisory grid whenever the chosen day changes. Failures are
  // surfaced with a retry — otherwise the step dead-ends with no start times
  // and no feedback (the picker still fails closed; server re-validates).
  useEffect(() => {
    if (!date) {
      setAvailability(null);
      setAvailabilityError(false);
      return;
    }
    const isoDate = formatCDMXDate(date);
    const ctrl = new AbortController();
    setLoading(true);
    setAvailability(null);
    setAvailabilityError(false);

    fetch(`/api/rental/availability?date=${encodeURIComponent(isoDate)}`, {
      signal: ctrl.signal,
      cache: 'no-store',
    })
      .then((res) => {
        if (!res.ok) throw new Error(`rental availability fetch failed: ${res.status}`);
        return res.json() as Promise<AvailabilityResponse>;
      })
      .then((data) => {
        setAvailability(data);
      })
      .catch((err: unknown) => {
        // Aborts are routine (date change / unmount) — only real failures
        // surface the warning.
        if (err instanceof Error && err.name === 'AbortError') return;
        setAvailabilityError(true);
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [date, retryTick]);

  const combos = useMemo<ReadonlyArray<RentalCombo>>(
    () => availability?.combos ?? [],
    [availability]
  );
  const dayRentable = availability?.rentable ?? null;

  // Distinct start times that have at least one available tier.
  const startTimes = useMemo(() => {
    const seen = new Set<string>();
    for (const c of combos) seen.add(c.startTime);
    return [...seen].sort();
  }, [combos]);

  const selectedCombo = useMemo(
    () => combos.find((c) => c.startTime === startTime && c.durationMinutes === durationMinutes) ?? null,
    [combos, startTime, durationMinutes]
  );

  function chooseDate(d: Date) {
    setDate(d);
    setStartTime('');
    setDurationMinutes(null);
    setQuantity(1);
    setDateError(null);
  }

  function chooseDuration(minutes: number) {
    setDurationMinutes(minutes);
    setQuantity(1);
    setOptionError(null);
  }

  function handleNext() {
    if (step === 1) {
      if (!date || !startTime) {
        setDateError('dateRequired');
        return;
      }
      setDateError(null);
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!selectedCombo) {
        setOptionError('comboRequired');
        return;
      }
      setOptionError(null);
      setStep(3);
      return;
    }
    if (step === 3) {
      // Reuse the SAME shared Zod schema BookingFlow uses so the shared
      // <StepDetails> component validates identically across both flows
      // (email semantics + optional-whatsapp format), no divergent hand-rolled
      // checks. StepDetails.renderError strips the `errors.` prefix for i18n.
      const result = stepDetailsSchema.safeParse({ name, email, whatsappOptional, country });
      if (!result.success) {
        const next: typeof detailErrors = {};
        for (const issue of result.error.issues) {
          const field = issue.path[0];
          if (field === 'name') next.name = issue.message;
          else if (field === 'email') next.email = issue.message;
          else if (field === 'whatsappOptional') next.whatsapp = issue.message;
          else if (field === 'country') next.country = issue.message;
        }
        setDetailErrors(next);
        return;
      }
      setDetailErrors({});
      setStep(4);
    }
  }

  function handleBack() {
    setStep((s) => (s > 1 ? ((s - 1) as StepKey) : s));
  }

  async function handlePay() {
    if (!date || !selectedCombo) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/rental/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formatCDMXDate(date),
          startTime,
          durationMinutes: selectedCombo.durationMinutes,
          quantity,
          customer: {
            name: name.trim(),
            email: email.trim(),
            whatsapp: whatsappOptional.trim(),
            country,
            locale,
          },
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSubmitError(mapCheckoutError(body.error));
        setSubmitting(false);
        return;
      }
      const body = (await res.json()) as { checkoutUrl?: string };
      if (!body.checkoutUrl) {
        setSubmitError('unexpected');
        setSubmitting(false);
        return;
      }
      window.location.assign(body.checkoutUrl);
    } catch (err) {
      console.error('[rental-checkout] request failed', err);
      setSubmitError('unexpected');
      setSubmitting(false);
    }
  }

  return (
    <div className="booking-page">
      <div className="container">
        <div
          className="steps"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
        >
          {([1, 2, 3, 4] as const).map((i) => (
            <div key={i} className={`step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              <span className="step-num">{i < step ? '✓' : i}</span>
              <span>{stepLabel(i, t)}</span>
            </div>
          ))}
        </div>

        <p className="mono" style={progressStyle}>
          {t('progressLabel', { current: step, total: TOTAL_STEPS })}
        </p>

        <div className="booking-layout">
          <div className="booking-main">
            {step === 1 ? (
              <div data-testid="rental-step-1">
                <h2>{t('steps.date.title')}</h2>
                <MiniCalendar
                  value={date}
                  onChange={chooseDate}
                  locale={locale}
                  prevLabel={t('summary.date')}
                  nextLabel={t('summary.date')}
                  isDateAvailable={isRentableCalendarDay}
                />
                {dateError ? (
                  <p role="alert" style={{ color: 'var(--terra)', marginTop: 12, fontSize: 14 }}>
                    {t(`errors.${dateError}`)}
                  </p>
                ) : null}

                {date && loading ? (
                  <p role="status" style={noticeStyle}>
                    {t('loading')}
                  </p>
                ) : null}
                {date && !loading && availabilityError ? (
                  <p role="alert" style={alertStyle}>
                    {t('availabilityError')}{' '}
                    <button
                      type="button"
                      onClick={() => setRetryTick((n) => n + 1)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: 'inherit',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        font: 'inherit',
                      }}
                    >
                      {t('availabilityRetry')}
                    </button>
                  </p>
                ) : null}
                {date && !loading && dayRentable === false ? (
                  <p role="status" style={noticeStyle}>
                    {t('notRentable')}
                  </p>
                ) : null}
                {date && !loading && dayRentable === true && startTimes.length === 0 ? (
                  <p role="status" style={noticeStyle}>
                    {t('noCombos')}
                  </p>
                ) : null}

                {startTimes.length > 0 ? (
                  <>
                    <h3 style={sectionHeading}>{t('steps.date.timeTitle')}</h3>
                    <div className="timeslots">
                      {startTimes.map((time) => (
                        <button
                          key={time}
                          type="button"
                          className={`timeslot ${startTime === time ? 'selected' : ''}`}
                          onClick={() => {
                            setStartTime(time);
                            setDurationMinutes(null);
                          }}
                          aria-pressed={startTime === time}
                        >
                          <strong style={{ fontFamily: 'var(--serif)', fontSize: 20, display: 'block' }}>
                            {time}
                          </strong>
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

            {step === 2 ? (
              <RentalOptions
                combos={combos}
                startTime={startTime}
                durationMinutes={durationMinutes}
                quantity={quantity}
                locale={locale}
                onDurationChange={chooseDuration}
                onQuantityChange={setQuantity}
                error={optionError}
              />
            ) : null}

            {step === 3 ? (
              <StepDetails
                name={name}
                email={email}
                whatsappOptional={whatsappOptional}
                country={country}
                locale={locale}
                onNameChange={setName}
                onEmailChange={setEmail}
                onWhatsappChange={setWhatsappOptional}
                onCountryChange={setCountry}
                errors={detailErrors}
              />
            ) : null}

            {step === 4 ? (
              <div style={{ textAlign: 'center' }} data-testid="rental-step-4">
                <h2>{t('steps.confirm.title')}</h2>
                <p className="lede">{t('steps.confirm.lede')}</p>
                <button
                  type="button"
                  className="btn btn-terra btn-lg"
                  onClick={handlePay}
                  disabled={submitting}
                  style={{ marginTop: 24 }}
                  data-testid="rental-confirm"
                >
                  {submitting ? t('creating') : `${t('payCta')} →`}
                </button>
                {submitError ? (
                  <p role="alert" style={alertStyle}>
                    {t(`errors.${submitError}`)}
                  </p>
                ) : null}
                <p className="mono" style={footerStyle}>
                  {t('steps.confirm.footer')}
                </p>
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48, gap: 12 }}>
              {step > 1 ? (
                <button type="button" className="btn btn-ghost" onClick={handleBack}>
                  ← {tButtons('back')}
                </button>
              ) : (
                <span />
              )}
              {step < 4 ? (
                <button
                  type="button"
                  className="btn btn-terra btn-lg"
                  onClick={handleNext}
                  data-testid="rental-next"
                >
                  {tButtons('next')} →
                </button>
              ) : null}
            </div>
          </div>

          {step >= 2 ? (
            <RentalSummary
              date={date}
              startTime={startTime}
              durationMinutes={selectedCombo?.durationMinutes ?? durationMinutes}
              unitPrice={selectedCombo?.unitPrice ?? 0}
              quantity={quantity}
              locale={locale}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

type SummaryProps = {
  date: Date | null;
  startTime: string;
  durationMinutes: number | null;
  unitPrice: number;
  quantity: number;
  locale: 'en' | 'es';
};

/** Compact rental summary sidebar — mirrors BookingSummary's presentation. */
function RentalSummary({ date, startTime, durationMinutes, unitPrice, quantity, locale }: SummaryProps) {
  const t = useTranslations('rentals.flow');
  const bcp47 = locale === 'es' ? 'es-MX' : 'en-US';
  // Format in CDMX — the selected instant represents a CDMX calendar day.
  const dateStr = date
    ? new Intl.DateTimeFormat(bcp47, {
        timeZone: TOUR_TIMEZONE,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(date)
    : '—';
  const money = (n: number) =>
    `$${new Intl.NumberFormat(bcp47, { maximumFractionDigits: 0 }).format(n)}`;
  const total = unitPrice * quantity;

  return (
    <aside className="cart-summary">
      <div className="cart-body">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          {t('summary.title')}
        </div>
        <div className="summary-row">
          <span>{t('summary.date')}</span>
          <span style={{ textTransform: 'capitalize' }}>{dateStr}</span>
        </div>
        <div className="summary-row">
          <span>{t('summary.time')}</span>
          <span>{startTime || '—'}</span>
        </div>
        <div className="summary-row">
          <span>{t('summary.duration')}</span>
          <span>{durationMinutes ? formatDurationLabel(durationMinutes, t) : '—'}</span>
        </div>
        <div className="summary-row">
          <span>{t('summary.bikes')}</span>
          <span>{quantity}</span>
        </div>
        <div className="summary-row">
          <span>{t('summary.unitPrice')}</span>
          <span>{unitPrice ? money(unitPrice) : '—'}</span>
        </div>
        <div className="summary-row total" style={{ borderTop: '1px solid var(--line)', marginTop: 8, paddingTop: 14 }}>
          <span>{t('summary.total')}</span>
          <span>{money(total)}</span>
        </div>
        <p className="mono" style={footerStyle}>
          {t('summary.totalNote')}
        </p>
      </div>
    </aside>
  );
}

/**
 * Calendar gate: a rental can only ever start today or tomorrow (§5). Enable
 * exactly those two days; the availability GET then makes the authoritative
 * rentable/closed call for the selected day.
 */
const MS_PER_DAY = 86_400_000;

function isRentableCalendarDay(d: Date): boolean {
  // Anchor "today/tomorrow" to CDMX (the flow's timezone and the availability
  // route's parser), not the browser's local day, so the calendar gate matches
  // the server's rentable days near midnight. Same formatCDMXDate used for the
  // fetch, keeping the enabled cell and the queried day consistent.
  const cellYmd = formatCDMXDate(d);
  const now = new Date();
  const todayYmd = formatCDMXDate(now);
  const tomorrowYmd = formatCDMXDate(new Date(now.getTime() + MS_PER_DAY));
  return cellYmd === todayYmd || cellYmd === tomorrowYmd;
}

function mapCheckoutError(code: string | undefined): string {
  switch (code) {
    case 'rental-unavailable':
      return 'rentalUnavailable';
    case 'unknown-tier':
      return 'unknownTier';
    default:
      return 'unexpected';
  }
}

function stepLabel(i: number, t: ReturnType<typeof useTranslations>): string {
  return [t('stepLabels.date'), t('stepLabels.options'), t('stepLabels.details'), t('stepLabels.confirm')][i - 1] ?? '';
}

const CDMX_YMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: TOUR_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Format a Date as YYYY-MM-DD in CDMX (matches the availability route's parser). */
function formatCDMXDate(date: Date): string {
  return CDMX_YMD.format(date);
}

const sectionHeading = {
  fontFamily: 'var(--serif)',
  fontSize: 24,
  fontWeight: 400,
  margin: '40px 0 16px',
  letterSpacing: '-0.01em',
} as const;

const progressStyle = {
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-muted)',
  margin: '8px 0 24px',
} as const;

const noticeStyle = {
  marginTop: 16,
  padding: '12px 14px',
  borderRadius: 6,
  background: 'var(--cream)',
  border: '1px solid var(--line)',
  color: 'var(--ink-soft)',
  fontSize: 14,
} as const;

const alertStyle = {
  marginTop: 16,
  padding: '12px 16px',
  background: 'var(--cream)',
  border: '1px solid var(--terra)',
  borderRadius: 6,
  color: 'var(--terra)',
} as const;

const footerStyle = {
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-muted)',
  marginTop: 12,
} as const;
