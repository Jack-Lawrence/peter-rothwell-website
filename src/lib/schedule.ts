// Run Club dates, set in the admin area (services.json, on the Run Club plan).
// Shown on the Run Club card and in the Run Club section; hidden when empty.

export interface Schedule {
  starts: string;
  when: string;
  spaces: string;
}

/** e.g. "Next block 6 Nov · Thursdays, 6pm · 4 spaces left", or "" if no date is set. */
export function scheduleLine(schedule?: Schedule, withWhen = true) {
  if (!schedule?.starts) return '';
  const date = new Date(schedule.starts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const spaces = schedule.spaces && `${schedule.spaces} ${schedule.spaces === '1' ? 'space' : 'spaces'} left`;
  return [`Next block ${date}`, withWhen && schedule.when, spaces].filter(Boolean).join(' · ');
}
