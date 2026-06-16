import type { BeforeListServerProps } from 'payload';

import { ReservasTabs } from './ReservasTabs';

/**
 * Injected above Payload's native bookings list via
 * `Bookings.admin.components.beforeList`.
 *
 * Renders the shared "Reservas" tab bar so the native table reads as the "All"
 * tab of the same surface as the custom week calendar (`/admin/agenda`),
 * letting the operator jump back to the calendar without the browser back
 * button. The table itself stays 100% native (filters, search, pagination).
 *
 * Server Component: Payload provides `i18n`; we only follow the admin UI
 * language to label the tabs es/en, matching the rest of the admin chrome.
 */

export default function BookingsBeforeList({ i18n }: BeforeListServerProps) {
  const language = i18n?.language === 'en' ? 'en' : 'es';
  return <ReservasTabs active="all" language={language} />;
}
