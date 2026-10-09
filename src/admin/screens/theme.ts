// Colours: pick a preset or set your own, with contrast checks.
import { h, field, Errors, errorSummary, toast } from '../ui';
import {
  checkPalette,
  derivePalette,
  isHex,
  mix,
  paletteFor,
  DEFAULT_PRESET,
  PRESETS,
  type Palette,
  type ThemeBase,
  type ThemeFile,
} from '../../lib/theme';
import { PATHS, store, toJson, save, savedMessage, setDirty, screen, heading, route, trackDirty } from '../app';

// ---------- Colours (theme) ----------

/** A small picture of the site in a palette: a dark section, then a light-mode strip. */
export function themePreview(p: Palette) {
  const lightBg = mix(p.paper, '#ffffff', 0.45);
  const lightAccent = mix(p.gorse, p.ink, 0.4);
  const plan = (bg: string) => h('span', { class: 'tp-plan', style: `background:${bg}` });
  return h(
    'div',
    { class: 'tp', 'aria-hidden': 'true' },
    h(
      'div',
      { class: 'tp-dark', style: `background:${p.ink};color:${p.paper}` },
      h('span', { class: 'tp-eyebrow', style: `color:${p.gorse}` }, 'Running & strength'),
      h('span', { class: 'tp-head' }, 'Run further.'),
      h('span', { class: 'tp-head', style: `color:${p.gorse}` }, 'Go past the wall.'),
      h('span', { class: 'tp-muted', style: `color:${p.stone}` }, 'Plans built around your life.'),
      h(
        'span',
        { class: 'tp-row' },
        h('span', { class: 'tp-btn', style: `background:${p.gorse};color:${p.ink}` }, 'Book a chat'),
        plan(p.loch),
        plan(p.gorse),
        plan(p.bracken),
      ),
    ),
    h(
      'div',
      { class: 'tp-light', style: `background:${lightBg};color:${p.ink}` },
      h('span', { class: 'tp-eyebrow', style: `color:${lightAccent}` }, 'Light mode'),
      h('span', { class: 'tp-muted', style: `color:${p['ink-muted']}` }, 'Text stays easy to read.'),
    ),
  );
}

export async function themeScreen() {
  const raw = await store!.read(PATHS.theme);
  const saved: ThemeFile = raw ? JSON.parse(raw) : { preset: DEFAULT_PRESET, custom: null };
  const summary = errorSummary();
  const defaultBase = PRESETS.find((p) => p.id === DEFAULT_PRESET)!.base;

  // What's chosen right now: a preset id, or "custom" with five colours.
  let choice = saved.preset;
  let base: ThemeBase =
    saved.preset === 'custom' && saved.custom
      ? { ...saved.custom }
      : { ...(PRESETS.find((p) => p.id === saved.preset) ?? PRESETS[0]).base };
  const palette = () => (choice === 'custom' ? derivePalette(base) : paletteFor({ preset: choice }));

  // Preset cards
  const radios: HTMLInputElement[] = [];
  const cards = h(
    'div',
    { class: 'theme-grid', role: 'radiogroup', 'aria-label': 'Colour themes' },
    PRESETS.map((preset) => {
      const radio = h('input', {
        type: 'radio',
        name: 'theme-preset',
        value: preset.id,
        id: `theme-${preset.id}`,
        class: 'visually-hidden',
        checked: preset.id === choice,
      });
      radio.addEventListener('change', () => {
        choice = preset.id;
        base = { ...preset.base };
        update(true);
      });
      radios.push(radio);
      return h(
        'label',
        { class: 'theme-card', for: radio.id },
        radio,
        themePreview(paletteFor({ preset: preset.id })),
        h(
          'span',
          { class: 'theme-name' },
          preset.name,
          preset.id === DEFAULT_PRESET && h('span', { class: 'theme-tag' }, 'Default'),
        ),
        h('span', { class: 'hint' }, preset.description),
      );
    }),
  );

  // Fine-tuning: the five colours of the chosen theme.
  const colourFields: [keyof ThemeBase, string][] = [
    ['background', 'Dark background'],
    ['light', 'Light background'],
    ['accent', 'Accent (buttons and highlights)'],
    ['plan1', 'First coaching plan'],
    ['plan3', 'Third coaching plan'],
  ];
  const inputs = {} as Record<keyof ThemeBase, HTMLInputElement>;
  const tune = h(
    'div',
    { class: 'colour-grid' },
    colourFields.map(([key, label]) => {
      const input = h('input', { type: 'color', value: base[key] });
      input.addEventListener('input', () => {
        if (!isHex(input.value)) return;
        base[key] = input.value.toLowerCase();
        choice = 'custom';
        update(false);
      });
      inputs[key] = input;
      return field(label, input).wrap;
    }),
  );

  const bigPreview = h('div', { class: 'theme-preview' });
  const report = h('div', { class: 'theme-report', 'aria-live': 'polite' });
  const status = h('p', { class: 'hint' });

  const update = (fromPreset: boolean) => {
    radios.forEach((r) => (r.checked = r.value === choice));
    if (fromPreset) (Object.keys(inputs) as (keyof ThemeBase)[]).forEach((k) => (inputs[k].value = base[k]));
    const p = palette();
    bigPreview.replaceChildren(themePreview(p));
    const failing = checkPalette(p).filter((c) => !c.ok);
    report.replaceChildren(
      failing.length
        ? h(
            'div',
            { class: 'theme-fail' },
            h('b', {}, 'Some text would be hard to read with these colours:'),
            h(
              'ul',
              {},
              failing.map((c) => h('li', {}, `${c.label} (${c.ratio.toFixed(1)}:1, needs ${c.min}:1)`)),
            ),
            h('p', {}, 'Try a lighter accent or plan colour, or a darker background.'),
          )
        : h('p', { class: 'theme-ok' }, '✓ All text passes the readability check, in dark and light mode.'),
    );
    const name = choice === 'custom' ? 'Your own colours' : PRESETS.find((p) => p.id === choice)?.name;
    status.textContent = `Chosen: ${name}.`;
    setDirty(true);
  };

  const resetBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn',
      onclick: (() => {
        choice = DEFAULT_PRESET;
        base = { ...defaultBase };
        update(true);
      }) as EventListener,
    },
    'Reset to default',
  );

  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save colours');
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        if (checkPalette(palette()).some((c) => !c.ok))
          errors.add(report, 'Some text would be hard to read with these colours. Adjust them, or pick a theme.');
        if (!errors.show()) return;
        const next: ThemeFile =
          choice === 'custom' ? { preset: 'custom', custom: base } : { preset: choice, custom: null };
        if (await save([{ path: PATHS.theme, text: toJson(next) }], 'Update colours', saveBtn)) {
          toast(savedMessage());
          route();
        }
      }) as EventListener,
    },
    h(
      'section',
      { class: 'stack', 'aria-labelledby': 'theme-presets' },
      h('h2', { id: 'theme-presets' }, 'Choose a theme'),
      cards,
      h('div', { class: 'row-actions' }, resetBtn, status),
    ),
    h(
      'section',
      { class: 'stack', 'aria-labelledby': 'theme-tune' },
      h('h2', { id: 'theme-tune' }, 'Fine-tune (optional)'),
      h(
        'p',
        { class: 'hint' },
        'Change any of the five colours. The other shades, and light mode, are worked out from them.',
      ),
      h('div', { class: 'theme-tune' }, tune, bigPreview),
      report,
    ),
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    'Colours',
    heading(
      'Colours',
      'Change the colours of your whole website. Pentlands is the original look; "Reset to default" always brings it back.',
    ),
    summary,
    form,
  );
  update(true);
  setDirty(false);
}
