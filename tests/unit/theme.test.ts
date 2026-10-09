import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PALETTE,
  DEFAULT_PRESET,
  PALETTE_KEYS,
  PRESETS,
  checkPalette,
  derivePalette,
  paletteCss,
  paletteFor,
} from '../../src/lib/theme';

describe('colour presets', () => {
  it.each(PRESETS.map((p) => [p.name, p] as const))('%s passes every contrast check, dark and light', (_, preset) => {
    const failures = checkPalette(paletteFor({ preset: preset.id })).filter((c) => !c.ok);
    expect(failures).toEqual([]);
  });

  it('checks both modes', () => {
    const labels = checkPalette(DEFAULT_PALETTE).map((c) => c.label);
    expect(labels.some((l) => l.startsWith('Dark mode'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Light mode'))).toBe(true);
  });
});

describe('a bad palette', () => {
  it('fails with messages that say which colours clash', () => {
    const grey = derivePalette({
      background: '#777777',
      light: '#8a8a8a',
      accent: '#808080',
      plan1: '#7a7a7a',
      plan3: '#858585',
    });
    const failures = checkPalette(grey).filter((c) => !c.ok);
    expect(failures.length).toBeGreaterThan(0);
    for (const f of failures) {
      expect(f.label).toMatch(/text/i);
      expect(f.ratio).toBeLessThan(f.min);
      expect(f.min).toBe(4.5);
    }
    expect(failures.map((f) => f.label)).toContain('Dark mode: text on the dark background');
  });
});

describe('Pentlands (the default)', () => {
  it('uses the exact hand-picked values from global.css', () => {
    expect(paletteFor({ preset: DEFAULT_PRESET })).toEqual(DEFAULT_PALETTE);
    expect(paletteFor(null)).toEqual(DEFAULT_PALETTE);
    const css = readFileSync('src/styles/global.css', 'utf8');
    for (const key of PALETTE_KEYS) {
      expect(css, `--${key}`).toContain(`--${key}: ${DEFAULT_PALETTE[key]};`);
    }
  });

  it('adds no extra CSS', () => {
    expect(paletteCss(DEFAULT_PALETTE)).toBe('');
    expect(paletteCss(paletteFor({ preset: 'heather' }))).toMatch(/^:root:root\{--ink:#211c24;/);
  });

  it('falls back to the default for an unknown preset or an empty custom one', () => {
    expect(paletteFor({ preset: 'nope' })).toEqual(DEFAULT_PALETTE);
    expect(paletteFor({ preset: 'custom', custom: null })).toEqual(DEFAULT_PALETTE);
  });
});
