// How long a client has trained with Peter, for the testimonials.
// A month is 30 whole days, so "Client for 1 month" needs at least 30 days.
// Ongoing clients are counted up to `now` (the build date on the site).

const DAY = 24 * 60 * 60 * 1000;

/** Whole 30-day months between two YYYY-MM-DD dates (or until `now` when ongoing). */
export function tenureMonths(started?: string, ended?: string, now = new Date()): number {
  if (!started) return 0;
  const start = Date.parse(started);
  const end = !ended || ended === 'ongoing' ? now.getTime() : Date.parse(ended);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.floor((end - start) / DAY / 30);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** e.g. "Client for 4 months", "Client for 1 year, 2 months". Empty under a month. */
export function tenureLabel(started?: string, ended?: string, now = new Date()): string {
  const months = tenureMonths(started, ended, now);
  if (months < 1) return '';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `Client for ${plural(months, 'month')}`;
  return `Client for ${plural(years, 'year')}${rest ? `, ${plural(rest, 'month')}` : ''}`;
}
