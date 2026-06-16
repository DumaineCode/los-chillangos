/**
 * Shared tab bar for the unified "Reservas" surface.
 *
 * The bookings experience is split across two routes that can't be merged into
 * one React page: the custom week calendar (`/admin/agenda`) and Payload's
 * native, fully-featured bookings list (`/admin/collections/bookings`). Rather
 * than reimplement the native table (filters, search, pagination, bulk
 * actions), we present BOTH routes under a single visual "Reservas" surface by
 * rendering the same tab bar on top of each one.
 *
 * Stateless and link-based on purpose: each host route knows which tab is
 * active and passes `active`, so this works in server-rendered admin views with
 * no client router. Plain `<a>` so a full navigation swaps between the custom
 * view and the native list cleanly.
 */

type Language = 'es' | 'en';

type TabId = 'week' | 'all';

const COPY: Record<Language, { week: string; all: string; aria: string }> = {
  es: { week: 'Semana', all: 'Todas', aria: 'Vistas de reservas' },
  en: { week: 'Week', all: 'All', aria: 'Booking views' },
};

const WEEK_HREF = '/admin/agenda';
const ALL_HREF = '/admin/collections/bookings';

const CalendarIcon = (
  <svg
    aria-hidden="true"
    fill="none"
    height="16"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
    width="16"
  >
    <rect height="16" rx="2" width="17" x="3.5" y="4.5" />
    <path d="M3.5 9h17" />
    <path d="M8 3v3M16 3v3" />
  </svg>
);

const ListIcon = (
  <svg
    aria-hidden="true"
    fill="none"
    height="16"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
    width="16"
  >
    <path d="M8 6h12M8 12h12M8 18h12" />
    <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);

export function ReservasTabs({ active, language }: { active: TabId; language: Language }) {
  const t = COPY[language];

  const tabs: { id: TabId; href: string; label: string; icon: React.ReactNode }[] = [
    { id: 'week', href: WEEK_HREF, label: t.week, icon: CalendarIcon },
    { id: 'all', href: ALL_HREF, label: t.all, icon: ListIcon },
  ];

  return (
    <nav className="lc-restabs" aria-label={t.aria}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <a
            key={tab.id}
            className={`lc-restabs__tab${isActive ? ' is-active' : ''}`}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="lc-restabs__icon" aria-hidden="true">
              {tab.icon}
            </span>
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}
