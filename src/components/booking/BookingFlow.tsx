'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { TOUR_TIMEZONE, getTimeSlotsForTour } from '../../lib/booking/availability';
import { calculatePrice } from '../../lib/booking/pricing';
import { stepDateSchema, stepDetailsSchema, stepPeopleSchema } from '../../lib/booking/schema';
import { BookingSummary } from './BookingSummary';
import { StepConfirm } from './StepConfirm';
import { StepDate, type StepDateTour } from './StepDate';
import { StepDetails } from './StepDetails';
import { StepPeople } from './StepPeople';

type BookingTour = {
  id: number;
  slug: string;
  title: string;
  category: 'ebike' | 'walking' | 'daytrip' | 'food';
  price: number;
  availableDays: ReadonlyArray<'0' | '1' | '2' | '3' | '4' | '5' | '6'>;
  timeSlots: ReadonlyArray<{ time: string; capacity: number }>;
};

type Props = {
  tour: BookingTour;
  /**
   * Kept for backward compat with the page boundary, but no longer consumed
   * by the wizard now that Sub-etapa C routes confirmation through Stripe
   * Checkout. Sub-etapa D's email templates may pull from this again.
   */
  contact?: {
    whatsapp: string;
    email: string;
  };
  siteUrl: string;
  locale: 'en' | 'es';
};

type StepKey = 1 | 2 | 3 | 4;
const TOTAL_STEPS = 4;

/**
 * Booking flow state machine (Sub-etapa C update).
 *
 * Four steps: date → people → details → confirm. Each step validates with
 * its Zod schema before the user can advance. The Confirm step now POSTs
 * to `/api/booking/checkout` which returns a Stripe Checkout URL.
 *
 * Capacity is per-slot, sourced from `tour.timeSlots[].capacity`. The
 * `stepPeopleSchema` factory takes the chosen slot's capacity so the
 * adults+teens cap is enforced against the right number.
 */
export function BookingFlow({ tour, locale }: Props) {
  const tButtons = useTranslations('booking.buttons');
  const tProgress = useTranslations('booking');

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

  const availableDays = tour.availableDays;
  const baseSlots = useMemo(
    () => getTimeSlotsForTour({ timeSlots: [...tour.timeSlots] }),
    [tour.timeSlots]
  );

  // Slot capacity drives Step 2's headcount cap.
  const slotCapacity = useMemo(() => {
    const chosen = baseSlots.find((s) => s.time === time);
    if (chosen) return chosen.capacity;
    if (baseSlots[0]) return baseSlots[0].capacity;
    return 8;
  }, [baseSlots, time]);

  const stepDateTour: StepDateTour = useMemo(
    () => ({
      id: tour.id,
      availableDays: [...tour.availableDays],
      timeSlots: tour.timeSlots.map((s) => ({ time: s.time, capacity: s.capacity })),
    }),
    [tour.id, tour.availableDays, tour.timeSlots]
  );

  const breakdown = useMemo(
    () => calculatePrice({ pricePerAdult: tour.price, adults, teens, privatize }),
    [tour.price, adults, teens, privatize]
  );

  // The exact payload that StepConfirm posts to /api/booking/checkout.
  // We build it eagerly so StepConfirm stays focused on UX, not data shape.
  const checkoutPayload = useMemo(
    () => ({
      tourId: tour.id,
      date: date ? formatCDMXDate(date) : '',
      time,
      adults,
      teens,
      privatize,
      customer: {
        name,
        email,
        whatsapp: whatsappOptional,
        locale,
      },
    }),
    [tour.id, date, time, adults, teens, privatize, name, email, whatsappOptional, locale]
  );

  function handleNext() {
    if (step === 1) {
      const schema = stepDateSchema({ availableDays });
      const result = schema.safeParse({ date, time });
      if (!result.success) {
        setDateError(result.error.issues[0]?.message ?? null);
        return;
      }
      setDateError(null);
      setStep(2);
      return;
    }
    if (step === 2) {
      const schema = stepPeopleSchema({ slotCapacity });
      const result = schema.safeParse({ adults, teens, privatize });
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
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
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
              <StepConfirm payload={checkoutPayload} />
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
                  tour={stepDateTour}
                  date={date}
                  time={time}
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
                  slotCapacity={slotCapacity}
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

const CDMX_YMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: TOUR_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Format a Date as YYYY-MM-DD in CDMX. `en-CA` formats numerically with `-`
 * separators so we can use the output directly without parsing.
 */
function formatCDMXDate(date: Date): string {
  return CDMX_YMD.format(date);
}
