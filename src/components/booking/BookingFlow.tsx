'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { calculatePrice } from '../../lib/booking/pricing';
import {
  stepDateSchema,
  stepDetailsSchema,
  stepPeopleSchema,
} from '../../lib/booking/schema';
import { getTimeSlotsForCategory } from '../../lib/booking/timeSlots';
import {
  BookingLinkError,
  buildMailtoLink,
  buildWhatsAppDeepLink,
  type BookingIntent,
  type BookingMessageLabels,
  type DeepLinkContext,
} from '../../lib/booking/whatsappDeepLink';
import { BookingSummary } from './BookingSummary';
import { StepConfirm } from './StepConfirm';
import { StepDate } from './StepDate';
import { StepDetails } from './StepDetails';
import { StepPeople } from './StepPeople';

type BookingTour = {
  slug: string;
  title: string;
  category: 'ebike' | 'walking' | 'daytrip' | 'food';
  price: number;
};

type Props = {
  tour: BookingTour;
  contact: {
    whatsapp: string;
    email: string;
  };
  siteUrl: string;
  locale: 'en' | 'es';
};

type StepKey = 1 | 2 | 3 | 4;
const TOTAL_STEPS = 4;

/**
 * Booking flow state machine (PR 5).
 *
 * Four steps: date → people → details → confirm. Each step validates with
 * its Zod schema before the user can advance. The Confirm step builds the
 * WhatsApp deep link (or mailto: fallback) and renders it as the primary
 * CTA.
 *
 * Zero persistence, zero payment — this is intent-only.
 */
export function BookingFlow({ tour, contact, siteUrl, locale }: Props) {
  const tButtons = useTranslations('booking.buttons');
  const tProgress = useTranslations('booking');
  const tMsg = useTranslations('booking.message');
  const tMsgLabels = useTranslations('booking.message.labels');
  const tSummary = useTranslations('booking.summary');

  const [step, setStep] = useState<StepKey>(1);
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState('');
  const [adults, setAdults] = useState(2);
  const [teens, setTeens] = useState(0);
  const [privatize, setPrivatize] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsappOptional, setWhatsappOptional] = useState('');

  const [dateError, setDateError] = useState<string | null>(null);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [detailErrors, setDetailErrors] = useState<{
    name?: string | null;
    email?: string | null;
    whatsapp?: string | null;
  }>({});

  const timeSlots = useMemo(() => getTimeSlotsForCategory(tour.category), [tour.category]);

  const breakdown = useMemo(
    () => calculatePrice({ pricePerAdult: tour.price, adults, teens, privatize }),
    [tour.price, adults, teens, privatize]
  );

  const labels: BookingMessageLabels = useMemo(
    () => ({
      greeting: tMsg('greeting'),
      name: tMsgLabels('name'),
      tour: tMsgLabels('tour'),
      date: tMsgLabels('date'),
      time: tMsgLabels('time'),
      people: tMsgLabels('people'),
      privatize: tMsgLabels('privatize'),
      total: tMsgLabels('total'),
      email: tMsgLabels('email'),
      whatsapp: tMsgLabels('whatsapp'),
      privatizeValue: tMsg('privatizeValue'),
      footer: tMsg('footer'),
      subject: tMsg('subject'),
      adultsValue: tSummary('adults', { count: adults }),
      teensValue: tSummary('teens', { count: teens }),
    }),
    [tMsg, tMsgLabels, tSummary, adults, teens]
  );

  const intent: BookingIntent = useMemo(
    () => ({
      tourTitle: tour.title,
      tourSlug: tour.slug,
      date: date ?? new Date(),
      time,
      adults,
      teens,
      privatize,
      estimatedTotal: breakdown.total,
      customerName: name,
      customerEmail: email,
      customerWhatsapp: whatsappOptional || undefined,
      locale,
    }),
    [tour, date, time, adults, teens, privatize, breakdown.total, name, email, whatsappOptional, locale]
  );

  const ctx: DeepLinkContext = useMemo(
    () => ({ contactWhatsapp: contact.whatsapp, contactEmail: contact.email, siteUrl }),
    [contact.whatsapp, contact.email, siteUrl]
  );

  const link = useMemo(() => {
    // Don't even attempt link-building until the user reaches the confirm
    // step — the schemas already gated everything that matters by then.
    if (step !== 4) return { href: '#', isMailto: false, configMissing: false };
    return resolveDeepLink(intent, ctx, labels);
  }, [step, intent, ctx, labels]);

  function handleNext() {
    if (step === 1) {
      const result = stepDateSchema.safeParse({ date, time });
      if (!result.success) {
        setDateError(result.error.issues[0]?.message ?? null);
        return;
      }
      setDateError(null);
      setStep(2);
      return;
    }
    if (step === 2) {
      const result = stepPeopleSchema.safeParse({ adults, teens, privatize });
      if (!result.success) {
        setPeopleError(result.error.issues[0]?.message ?? null);
        return;
      }
      setPeopleError(null);
      setStep(3);
      return;
    }
    if (step === 3) {
      const result = stepDetailsSchema.safeParse({ name, email, whatsappOptional });
      if (!result.success) {
        const next: typeof detailErrors = {};
        for (const issue of result.error.issues) {
          const field = issue.path[0];
          if (field === 'name') next.name = issue.message;
          else if (field === 'email') next.email = issue.message;
          else if (field === 'whatsappOptional') next.whatsapp = issue.message;
        }
        setDetailErrors(next);
        return;
      }
      setDetailErrors({});
      setStep(4);
      return;
    }
  }

  function handleBack() {
    setStep((s) => (s > 1 ? ((s - 1) as StepKey) : s));
  }

  function handleConfirm() {
    if (link.href === '#') return;
    // The <a> already navigates. We still set window.location.href as a
    // belt-and-suspenders push for wa.me on some mobile browsers.
    try {
      window.location.href = link.href;
    } catch {
      // window.location is read-only in some test environments — fine.
    }
  }

  return (
    <div className="booking-page">
      <div className="container">
        <div className="steps" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
            >
              <span className="step-num">{i < step ? '✓' : i}</span>
              <span>{stepLabel(i, locale)}</span>
            </div>
          ))}
        </div>

        <p
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--ink-muted)',
            margin: '8px 0 24px',
          }}
        >
          {tProgress('progressLabel', { current: step, total: TOTAL_STEPS })}
        </p>

        {step === 4 ? (
          <div className="booking-layout">
            <div className="booking-main">
              <StepConfirm
                href={link.href}
                isMailto={link.isMailto}
                configMissing={link.configMissing}
                onConfirm={handleConfirm}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 32 }}>
                <button type="button" className="btn btn-ghost" onClick={handleBack}>
                  ← {tButtons('back')}
                </button>
              </div>
            </div>
            <BookingSummary
              tourTitle={tour.title}
              date={date}
              time={time}
              adults={adults}
              teens={teens}
              privatize={privatize}
              breakdown={breakdown}
              locale={locale}
            />
          </div>
        ) : (
          <div className="booking-layout">
            <div className="booking-main">
              {step === 1 && (
                <StepDate
                  date={date}
                  time={time}
                  timeSlots={timeSlots}
                  onDateChange={setDate}
                  onTimeChange={setTime}
                  locale={locale}
                  error={dateError}
                />
              )}
              {step === 2 && (
                <StepPeople
                  adults={adults}
                  teens={teens}
                  privatize={privatize}
                  pricePerAdult={tour.price}
                  locale={locale}
                  onAdultsChange={setAdults}
                  onTeensChange={setTeens}
                  onPrivatizeChange={setPrivatize}
                  error={peopleError}
                />
              )}
              {step === 3 && (
                <StepDetails
                  name={name}
                  email={email}
                  whatsappOptional={whatsappOptional}
                  onNameChange={setName}
                  onEmailChange={setEmail}
                  onWhatsappChange={setWhatsappOptional}
                  errors={detailErrors}
                />
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 48,
                  gap: 12,
                }}
              >
                {step > 1 ? (
                  <button type="button" className="btn btn-ghost" onClick={handleBack}>
                    ← {tButtons('back')}
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className="btn btn-terra btn-lg"
                  onClick={handleNext}
                  data-testid="booking-next"
                >
                  {tButtons('next')} →
                </button>
              </div>
            </div>

            {step >= 2 ? (
              <BookingSummary
                tourTitle={tour.title}
                date={date}
                time={time}
                adults={adults}
                teens={teens}
                privatize={privatize}
                breakdown={breakdown}
                locale={locale}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function stepLabel(i: number, locale: 'en' | 'es'): string {
  if (locale === 'es') {
    return ['Fecha', 'Personas', 'Datos', 'Confirmar'][i - 1] ?? '';
  }
  return ['Date', 'People', 'Details', 'Confirm'][i - 1] ?? '';
}

function resolveDeepLink(
  intent: BookingIntent,
  ctx: DeepLinkContext,
  labels: BookingMessageLabels
): { href: string; isMailto: boolean; configMissing: boolean } {
  const hasWhatsapp = ctx.contactWhatsapp.replace(/\D+/g, '').length > 0;
  const hasEmail = ctx.contactEmail.trim().length > 0;

  if (hasWhatsapp) {
    try {
      return { href: buildWhatsAppDeepLink(intent, ctx, labels), isMailto: false, configMissing: false };
    } catch (err) {
      if (!(err instanceof BookingLinkError)) throw err;
    }
  }

  if (hasEmail) {
    try {
      return { href: buildMailtoLink(intent, ctx, labels), isMailto: true, configMissing: false };
    } catch (err) {
      if (!(err instanceof BookingLinkError)) throw err;
    }
  }

  return { href: '#', isMailto: false, configMissing: true };
}
