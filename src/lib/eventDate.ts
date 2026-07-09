/**
 * Format an event date in French with the first letter capitalised
 * ("Samedi 15 avril 2023 à 19:00").
 *
 * Event dates are stored as tz-less timestamps in YAML frontmatter
 * (e.g. `2023-04-15T19:00:00`). YAML parses these as **UTC**, so the Date
 * holds exactly the typed wall-clock numbers at UTC. We therefore format in
 * UTC to display the intended local time verbatim — host-independent, no DST
 * surprises, no build-time TZ needed. (The CMS writes the same format.)
 */
export function formatEventDate(date: Date, withYear = false): string {
  const s = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' as const } : {}),
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
