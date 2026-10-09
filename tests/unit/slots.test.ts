import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SLOTS } from '../../src/lib/slots';

const css = (file: string) => readFileSync(`src/components/${file}`, 'utf8');

describe('photo slots', () => {
  it('are big enough for sharp photos and fit Instagram exports', () => {
    for (const slot of Object.values(SLOTS)) {
      expect(slot.width).toBeGreaterThanOrEqual(1080);
      expect(slot.width).toBeLessThanOrEqual(1080); // Instagram photos are 1080 wide
    }
  });

  it('match the shape of their box on the site', () => {
    expect(SLOTS.hero.width / SLOTS.hero.height).toBe(4 / 5);
    expect(css('Hero.astro')).toContain('aspect-ratio: 4 / 5');
    expect(SLOTS.runClub.width / SLOTS.runClub.height).toBe(4 / 5);
    expect(css('RunClub.astro')).toContain('aspect-ratio: 4 / 5');
    expect(SLOTS.portrait.width).toBe(SLOTS.portrait.height);
  });

  it('keep a sensible safe area', () => {
    expect(SLOTS.hero.safeHeight).toBeGreaterThan(0.5);
    expect(SLOTS.hero.safeHeight).toBeLessThanOrEqual(1);
  });
});
