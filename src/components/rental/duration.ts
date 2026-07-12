/**
 * Human label for a rental tier duration.
 *
 * Whole-hour tiers (60/120/240/360…) render as "N hours" via the pluralized
 * `rentals.flow.hoursLabel`; anything else falls back to a minutes label. The
 * `t` argument is the `rentals.flow` next-intl translator so the label stays
 * locale-aware (en/es) without duplicating the strings.
 */
type FlowTranslator = (key: string, values?: Record<string, string | number>) => string;

export function formatDurationLabel(durationMinutes: number, t: FlowTranslator): string {
  if (durationMinutes > 0 && durationMinutes % 60 === 0) {
    return t('hoursLabel', { count: durationMinutes / 60 });
  }
  return t('minutesLabel', { count: durationMinutes });
}
