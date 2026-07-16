/**
 * Format an event date in French with the first letter capitalised
 * ("Samedi 15 avril 2023"). The time of day is never shown: the free-text
 * `horaire` frontmatter field owns that display (all-day events, ranges…);
 * the stored time only orders same-day events.
 *
 * Event dates are stored as tz-less timestamps in YAML frontmatter
 * (e.g. `2023-04-15T19:00:00`). YAML parses these as **UTC**, so the Date
 * holds exactly the typed wall-clock numbers at UTC. We therefore format in
 * UTC to display the intended date verbatim — host-independent, no DST
 * surprises, no build-time TZ needed. (The CMS writes the same format.)
 */
export function formatEventDate(date: Date, withYear = false): string {
  const s = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
