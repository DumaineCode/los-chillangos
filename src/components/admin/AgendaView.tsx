import type { AdminViewServerProps } from 'payload';

import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';

import { getWeekAgenda } from '../../lib/booking/agenda';
import { AgendaWeek } from './AgendaWeek';

/**
 * Custom admin view registered at `/admin/agenda` via
 * `admin.components.views.agenda` in `payload.config.ts`.
 *
 * Server Component (the container): authenticates, reads the requested week's
 * agenda through the local Payload API, and hands a plain, fully-computed
 * `WeekAgenda` to the `AgendaWeek` client component (the presentation).
 *
 * Why a calendar instead of the default Bookings table: a table lists
 * individual bookings, but capacity lives per departure (tour + day + time).
 * This view groups bookings into departures and shows each one's fill level, so
 * the operator sees at a glance what is scheduled and how full it is.
 *
 * The week is driven by `?week=YYYY-MM-DD`; absent/invalid → the current week.
 * Wrapped in `DefaultTemplate` so it inherits the admin nav, header and theme.
 */

const WEEK_PARAM = /^\d{4}-\d{2}-\d{2}$/;

function parseWeekAnchor(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !WEEK_PARAM.test(value)) return undefined;
  // Noon UTC = 06:00 CDMX, same calendar day — lands the anchor on the intended
  // CDMX day without any timezone drift at the boundaries.
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function AgendaView({
  initPageResult,
  params,
  searchParams,
}: AdminViewServerProps) {
  const { req } = initPageResult;
  const { payload, user, i18n } = req;

  const language = i18n.language === 'en' ? 'en' : 'es';
  const localeCode = initPageResult.locale?.code === 'en' ? 'en' : 'es';
  const anchor = parseWeekAnchor(searchParams?.week) ?? new Date();

  // Payload protects admin views behind auth, but guard defensively: never run
  // the reads (overrideAccess) for an unauthenticated request.
  const agenda = user ? await getWeekAgenda({ payload, anchor, locale: localeCode }) : null;

  return (
    <DefaultTemplate
      i18n={i18n}
      locale={initPageResult.locale}
      params={params}
      payload={payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={user || undefined}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        {agenda ? (
          <AgendaWeek agenda={agenda} language={language} />
        ) : (
          <p>
            {language === 'es'
              ? 'Inicia sesión para ver la agenda.'
              : 'Sign in to see the agenda.'}
          </p>
        )}
      </Gutter>
    </DefaultTemplate>
  );
}
