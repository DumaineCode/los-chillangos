import { getTranslation } from '@payloadcms/translations';
import Link from 'next/link';

/**
 * Nav link injected via `admin.components.afterNavLinks`, pointing to the custom
 * `/admin/agenda` view. Gives the non-technical client a persistent left-menu
 * entry to the visual week agenda (the default Bookings table stays as the
 * searchable list). Label follows the admin UI language like the field labels.
 */

type I18nArg = Parameters<typeof getTranslation>[1];

const CalendarIcon = (
  <svg
    aria-hidden="true"
    fill="none"
    height="18"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
    width="18"
  >
    <rect height="16" rx="2" width="17" x="3.5" y="4.5" />
    <path d="M3.5 9h17" />
    <path d="M8 3v3M16 3v3" />
  </svg>
);

export default function AgendaNavLink({ i18n }: { i18n: I18nArg }) {
  const label = getTranslation({ en: 'Weekly agenda', es: 'Agenda semanal' }, i18n);

  return (
    <Link className="lc-navlink" href="/admin/agenda">
      <span className="lc-navlink__icon" aria-hidden="true">
        {CalendarIcon}
      </span>
      {label}
    </Link>
  );
}
