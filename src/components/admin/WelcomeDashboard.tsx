import { getTranslation } from '@payloadcms/translations';
import type { ReactNode } from 'react';

/**
 * Welcome panel rendered above the admin dashboard via
 * `admin.components.beforeDashboard`.
 *
 * Goal: orient a non-technical, first-time client the moment they log in —
 * instead of a bare list of collections, they see "what do you want to do?"
 * with big, plain-language shortcuts to the three things they actually do
 * (edit the home page, manage tours, see bookings).
 *
 * Server Component: Payload passes `i18n` (among other ServerProps). We type
 * ONLY what we use and derive the i18n type from `getTranslation` itself so we
 * don't depend on type re-exports. Text follows the admin UI language (es/en)
 * through `getTranslation`, matching the field labels from Layer 1.
 *
 * Links use the default admin route (`/admin`) — no custom `routes.admin` is set
 * in payload.config.ts.
 */

type I18nArg = Parameters<typeof getTranslation>[1];

type Translatable = { en: string; es: string };

type ShortcutCard = {
  body: Translatable;
  href: string;
  icon: ReactNode;
  title: Translatable;
};

const HomeIcon = (
  <svg
    aria-hidden="true"
    fill="none"
    height="22"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
    width="22"
  >
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </svg>
);

const MapPinIcon = (
  <svg
    aria-hidden="true"
    fill="none"
    height="22"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
    width="22"
  >
    <path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10Z" />
    <circle cx="12" cy="11" r="2.2" />
  </svg>
);

const CalendarIcon = (
  <svg
    aria-hidden="true"
    fill="none"
    height="22"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
    width="22"
  >
    <rect height="16" rx="2" width="17" x="3.5" y="4.5" />
    <path d="M3.5 9h17" />
    <path d="M8 3v3M16 3v3" />
  </svg>
);

const CARDS: ShortcutCard[] = [
  {
    href: '/admin/globals/landing',
    icon: HomeIcon,
    title: { en: 'Edit the home page', es: 'Editar la página de inicio' },
    body: {
      en: 'Change the text, photos and sections of your homepage.',
      es: 'Cambia los textos, las fotos y las secciones de tu portada.',
    },
  },
  {
    href: '/admin/collections/tours',
    icon: MapPinIcon,
    title: { en: 'Tours', es: 'Tours' },
    body: {
      en: 'Create and edit your tours — prices, photos and schedule.',
      es: 'Crea y edita tus tours: precios, fotos y horarios.',
    },
  },
  {
    href: '/admin/collections/bookings',
    icon: CalendarIcon,
    title: { en: 'Bookings', es: 'Reservas' },
    body: {
      en: "See your customers' bookings.",
      es: 'Mira las reservas de tus clientes.',
    },
  },
];

export default function WelcomeDashboard({ i18n }: { i18n: I18nArg }) {
  const tr = (label: Translatable) => getTranslation(label, i18n);

  return (
    <div className="lc-welcome">
      <div className="lc-welcome__head">
        <h2 className="lc-welcome__title">
          {tr({ en: 'What would you like to do?', es: '¿Qué quieres hacer hoy?' })}
        </h2>
        <p className="lc-welcome__sub">
          {tr({
            en: 'Pick an option to get started. You can always use the left menu too.',
            es: 'Elige una opción para empezar. También puedes usar el menú de la izquierda.',
          })}
        </p>
      </div>
      <div className="lc-welcome__grid">
        {CARDS.map((card) => (
          <a className="lc-welcome__card" href={card.href} key={card.href}>
            <span aria-hidden="true" className="lc-welcome__icon">
              {card.icon}
            </span>
            <span className="lc-welcome__card-title">{tr(card.title)}</span>
            <span className="lc-welcome__card-body">{tr(card.body)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
