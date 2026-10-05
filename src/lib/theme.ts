// Colour themes. Peter picks one in the admin area (Colours), or fine-tunes his
// own; the choice is saved in src/data/theme.json and applied to every page by
// overriding the palette tokens in src/styles/global.css. Light mode is built
// from the same tokens, so a theme covers both modes.
//
// A theme is set by five colours; the other shades are mixed from them the same
// way the default palette's shades relate to each other. The default
// (Pentlands) keeps its exact hand-picked values, so "Reset to default" gives
// back the original look exactly.
//
// Used by the site (Base.astro) and the admin (Colours screen), so keep it free
// of anything browser- or Astro-specific.

export interface ThemeBase {
  /** Dark background (the granite sections). */
  background: string;
  /** Light background (the chalk sections) and text on dark. */
  light: string;
  /** The accent: buttons, highlights, the contact section. */
  accent: string;
  /** Coaching plan panels either side of the accent one. */
  plan1: string;
  plan3: string;
}

/** The palette tokens in global.css that a theme sets. */
export type Palette = Record<(typeof PALETTE_KEYS)[number], string>;
export const PALETTE_KEYS = [
  'ink',
  'ink-2',
  'ink-panel',
  'ink-line',
  'stone',
  'stone-2',
  'paper',
  'chalk-2',
  'chalk-line',
  'ink-soft',
  'ink-muted',
  'gorse',
  'loch',
  'bracken',
] as const;

export interface ThemeFile {
  /** A preset's id, or "custom". */
  preset: string;
  /** The five colours, when preset is "custom". */
  custom?: ThemeBase | null;
}

// ---------- Colour maths ----------

type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
}
export const rgbToHex = (rgb: RGB) =>
  `#${rgb
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

/** Same as CSS color-mix(in srgb, a share%, b). */
export function mix(a: string, b: string, share: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x.map((v, i) => v * share + y[i] * (1 - share)) as RGB);
}

function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

export const isHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

// ---------- Palettes ----------

/** The other shades, mixed from the five base colours. */
export function derivePalette(base: ThemeBase): Palette {
  const { background: ink, light: paper } = base;
  return {
    ink,
    'ink-2': mix(paper, ink, 0.035),
    'ink-panel': mix(paper, ink, 0.07),
    'ink-line': mix(paper, ink, 0.12),
    stone: mix(paper, ink, 0.67),
    'stone-2': mix(paper, ink, 0.8),
    paper,
    'chalk-2': mix(ink, paper, 0.1),
    'chalk-line': mix(ink, paper, 0.17),
    'ink-soft': mix(paper, ink, 0.15),
    'ink-muted': mix(paper, ink, 0.31),
    gorse: base.accent,
    loch: base.plan1,
    bracken: base.plan3,
  };
}

/** The original Pentlands palette, exactly as in global.css. */
export const DEFAULT_PALETTE: Palette = {
  ink: '#1b211e',
  'ink-2': '#222a26',
  'ink-panel': '#2a332e',
  'ink-line': '#34403a',
  stone: '#a9b3ad',
  'stone-2': '#c4ccc7',
  paper: '#eeede8',
  'chalk-2': '#d9dbd5',
  'chalk-line': '#c9ccc6',
  'ink-soft': '#3b4540',
  'ink-muted': '#5c6862',
  gorse: '#e3b23c',
  loch: '#3c9de3',
  bracken: '#e35d3c',
};

export interface Preset {
  id: string;
  name: string;
  description: string;
  base: ThemeBase;
}

export const DEFAULT_PRESET = 'pentlands';

export const PRESETS: Preset[] = [
  {
    id: 'pentlands',
    name: 'Pentlands',
    description: 'Granite green and gorse yellow. The original look.',
    base: { background: '#1b211e', light: '#eeede8', accent: '#e3b23c', plan1: '#3c9de3', plan3: '#e35d3c' },
  },
  {
    id: 'heather',
    name: 'Heather',
    description: 'Dark peat with heather pink, like the hills in late summer.',
    base: { background: '#211c24', light: '#efecee', accent: '#e08fbd', plan1: '#9b9be6', plan3: '#e8a35c' },
  },
  {
    id: 'loch',
    name: 'Loch',
    description: 'Deep water blue with a bright loch-side teal.',
    base: { background: '#15202a', light: '#ebeeef', accent: '#4fc4c4', plan1: '#86a8ef', plan3: '#e9a65d' },
  },
  {
    id: 'bracken',
    name: 'Bracken',
    description: 'Warm earth brown with autumn bracken orange.',
    base: { background: '#221c18', light: '#efebe5', accent: '#e8893f', plan1: '#d9b545', plan3: '#9cc26a' },
  },
  {
    id: 'moss',
    name: 'Moss',
    description: 'Forest dark green with fresh moss.',
    base: { background: '#162019', light: '#ebefe7', accent: '#a9cc5a', plan1: '#5fc4a4', plan3: '#e3b23c' },
  },
  {
    id: 'coal',
    name: 'Coal',
    description: 'Near-black and off-white, with a signal-red accent.',
    base: { background: '#1a1a1a', light: '#efeeec', accent: '#ff6e4e', plan1: '#8db7e3', plan3: '#e6c34a' },
  },
];

/** The palette for a saved theme choice. */
export function paletteFor(theme: ThemeFile | null | undefined): Palette {
  if (theme?.preset === 'custom' && theme.custom) return derivePalette(theme.custom);
  if (!theme || theme.preset === DEFAULT_PRESET) return DEFAULT_PALETTE;
  const preset = PRESETS.find((p) => p.id === theme.preset);
  return preset ? derivePalette(preset.base) : DEFAULT_PALETTE;
}

/** CSS that applies a palette (empty for the default, which global.css already has). */
export function paletteCss(palette: Palette): string {
  if (PALETTE_KEYS.every((k) => palette[k] === DEFAULT_PALETTE[k])) return '';
  // ":root:root" outranks the defaults in global.css wherever this ends up in <head>.
  return `:root:root{${PALETTE_KEYS.map((k) => `--${k}:${palette[k]}`).join(';')}}`;
}

// ---------- Contrast checks ----------

export interface Check {
  label: string;
  ratio: number;
  min: number;
  ok: boolean;
}

/**
 * Checks the colour pairs the site actually uses, in dark and light mode, against
 * WCAG AA: 4.5:1 for text. Mirrors the light-mode mixes in global.css.
 */
export function checkPalette(p: Palette): Check[] {
  const white = '#ffffff';
  const lightGranite = mix(p.paper, white, 0.45);
  const lightGranite2 = mix(p.paper, p['chalk-2'], 0.6);
  const lightAccent = mix(p.gorse, p.ink, 0.4);
  const pairs: [string, string, string][] = [
    ['Dark mode: text on the dark background', p.paper, p.ink],
    ['Dark mode: text on the second dark background', p.paper, p['ink-2']],
    ['Dark mode: softer text', p.stone, p.ink],
    ['Dark mode: softer text on the second background', p.stone, p['ink-2']],
    ['Dark mode: accent text (small labels)', p.gorse, p.ink],
    ['Dark mode: accent text on the second background', p.gorse, p['ink-2']],
    ['Text on accent buttons and the contact section', p.ink, p.gorse],
    ['Text on the light sections', p.ink, p.paper],
    ['Softer text on the light sections', p['ink-muted'], p.paper],
    ['Text on coaching plan 1', p.ink, p.loch],
    ['Text on coaching plan 3', p.ink, p.bracken],
    ['Light mode: text', p.ink, lightGranite],
    ['Light mode: softer text', p['ink-muted'], lightGranite],
    ['Light mode: softer text on the second background', p['ink-muted'], lightGranite2],
    ['Light mode: accent text', lightAccent, lightGranite],
    ['Light mode: accent text on the second background', lightAccent, lightGranite2],
  ];
  return pairs.map(([label, a, b]) => {
    const ratio = contrast(a, b);
    return { label, ratio, min: 4.5, ok: ratio >= 4.5 };
  });
}
