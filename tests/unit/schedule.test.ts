import { describe, expect, it } from 'vitest';
import { scheduleLine } from '../../src/lib/schedule';

describe('scheduleLine', () => {
  it('is empty without a start date', () => {
    expect(scheduleLine()).toBe('');
    expect(scheduleLine({ starts: '', when: 'Thursdays, 6pm', spaces: '4' })).toBe('');
  });

  it('describes the next block', () => {
    expect(scheduleLine({ starts: '2026-11-06', when: 'Thursdays, 6pm', spaces: '4' })).toBe(
      'Next block 6 Nov · Thursdays, 6pm · 4 spaces left',
    );
  });

  it('says "space" for one', () => {
    expect(scheduleLine({ starts: '2026-11-06', when: '', spaces: '1' })).toBe('Next block 6 Nov · 1 space left');
  });

  it('can leave out the day and time', () => {
    expect(scheduleLine({ starts: '2026-11-06', when: 'Thursdays, 6pm', spaces: '' }, false)).toBe('Next block 6 Nov');
  });
});
