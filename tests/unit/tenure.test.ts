import { describe, expect, it } from 'vitest';
import { tenureLabel, tenureMonths } from '../../src/lib/tenure';

const now = new Date('2026-10-09T12:00:00Z');

describe('tenureMonths', () => {
  it('counts whole 30-day months', () => {
    expect(tenureMonths('2026-09-10', '2026-10-09')).toBe(0); // 29 days
    expect(tenureMonths('2026-09-09', '2026-10-09')).toBe(1); // 30 days
  });

  it('counts ongoing clients up to now', () => {
    expect(tenureMonths('2026-06-01', 'ongoing', now)).toBe(4);
    expect(tenureMonths('2026-06-01', undefined, now)).toBe(4);
  });

  it('is 0 without a start, with bad dates or an end before the start', () => {
    expect(tenureMonths(undefined, undefined, now)).toBe(0);
    expect(tenureMonths('not a date', undefined, now)).toBe(0);
    expect(tenureMonths('2026-06-01', '2026-05-01')).toBe(0);
  });
});

describe('tenureLabel', () => {
  it('is empty under a month', () => {
    expect(tenureLabel('2026-09-20', 'ongoing', now)).toBe('');
  });

  it('uses months, then years and months', () => {
    expect(tenureLabel('2026-09-01', 'ongoing', now)).toBe('Client for 1 month');
    expect(tenureLabel('2026-06-01', 'ongoing', now)).toBe('Client for 4 months');
    expect(tenureLabel('2025-10-01', '2026-10-01')).toBe('Client for 1 year');
    expect(tenureLabel('2025-01-01', '2026-03-15')).toBe('Client for 1 year, 2 months');
  });
});
