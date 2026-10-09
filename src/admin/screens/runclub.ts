// The Run Club section: wording, key facts and the next block.
import { h, field, textInput, Errors, errorSummary, toast, today } from '../ui';
import { type Change } from '../store';
import { textGroup, setPath } from '../text-fields';
import {
  PATHS,
  type Service,
  readJson,
  toJson,
  save,
  savedMessage,
  setDirty,
  screen,
  heading,
  trackDirty,
} from '../app';
import { type Site, sectionHeading, infoBox } from './website';
import { type SitePhoto } from './photos';

// ---------- Run Club ----------

export interface RunClub {
  eyebrow: string;
  headline: string;
  paragraphs: string[];
  facts: { label: string; value: string; note: string }[];
  button: string;
  photos?: SitePhoto[];
}

export async function runClubScreen() {
  const [services, site] = await Promise.all([
    readJson<Service[]>(PATHS.services),
    readJson<{ runClub?: RunClub } & Site>(PATHS.site),
  ]);
  const plan = services.find((s) => s.id === 'runclub');
  if (!plan || !site.runClub) {
    screen('Run Club', heading('Run Club'), h('p', {}, 'The Run Club is missing from your website’s files.'));
    return;
  }
  const club = site.runClub;
  const sched = plan.schedule ?? { starts: '', when: '', spaces: '' };
  const summary = errorSummary();

  const words = textGroup(site, 'What it says', [
    { path: 'runClub.eyebrow', label: 'Small heading', max: 40 },
    { path: 'runClub.headline', label: 'Big heading', max: 50, hint: 'e.g. “Run together. Get faster.”' },
    {
      path: 'runClub.paragraphs',
      label: 'About the Run Club',
      kind: 'paras',
      most: 4,
      max: 600,
      hint: 'Leave an empty line between paragraphs. Two short paragraphs work best.',
    },
    { path: 'runClub.button', label: 'Button', max: 26, hint: 'It goes to the enquiry form, with Run Club picked.' },
  ]);

  // The four boxes of key facts.
  const facts = [0, 1, 2, 3].map((i) => {
    const f = (club.facts ?? [])[i] ?? { label: '', value: '', note: '' };
    const label = field('Small label', textInput(f.label, { maxlength: 24 }));
    const value = field('Big text', textInput(f.value, { maxlength: 16 }), 'Short, e.g. “8 sessions”.');
    const note = field('Line underneath', textInput(f.note, { maxlength: 40 }));
    return {
      label,
      value,
      note,
      box: h('fieldset', { class: 'box' }, h('legend', {}, `Box ${i + 1}`), label.wrap, value.wrap, note.wrap),
    };
  });

  const starts = field('Next block starts (optional)', h('input', { type: 'date', value: sched.starts }));
  const when = field(
    'Day and time',
    textInput(sched.when || 'Thursdays, 6pm', { maxlength: 40 }),
    'Shown with the date on the Run Club plan card, e.g. “Thursdays, 6pm”.',
  );
  const spaces = field(
    'Spaces left (optional)',
    textInput(sched.spaces, { inputmode: 'numeric', maxlength: 3 }),
    'Leave empty to hide it.',
  );
  const clearDates = h(
    'button',
    {
      type: 'button',
      class: 'btn btn--small',
      onclick: (() => {
        (starts.input as HTMLInputElement).value = '';
        spaces.input.value = '';
        setDirty(true);
      }) as EventListener,
    },
    'Clear dates',
  );
  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save changes');

  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        words.check(errors);
        facts.forEach((f, i) => {
          const any = [f.label, f.value, f.note].some((x) => x.input.value.trim());
          if (any && !f.value.input.value.trim())
            errors.add(f.value, `Box ${i + 1}: add the big text, or clear the box.`);
        });
        if (!facts.some((f) => f.value.input.value.trim())) errors.add(facts[0].value, 'Fill in at least one box.');
        const date = (starts.input as HTMLInputElement).value;
        if (date && date < today())
          errors.add(starts, 'That date has passed. Choose the next block’s start date, or press Clear dates.');
        if (date && !when.input.value.trim()) errors.add(when, 'Say which day and time, e.g. “Thursdays, 6pm”.');
        if (spaces.input.value.trim() && !/^\d{1,3}$/.test(spaces.input.value.trim()))
          errors.add(spaces, 'Spaces left should be a number, like 6. Or leave it empty.');
        if (!errors.show()) return;

        const schedule = date
          ? { starts: date, when: when.input.value.trim(), spaces: spaces.input.value.trim() }
          : undefined;
        const nextServices = services.map((s) => (s.id === 'runclub' ? { ...s, schedule } : s));
        const nextFacts = facts.map((f) => ({
          label: f.label.input.value.trim(),
          value: f.value.input.value.trim(),
          note: f.note.input.value.trim(),
        }));
        const nextSite = setPath(words.apply(site), 'runClub.facts', nextFacts);
        const changes: Change[] = [
          { path: PATHS.site, text: toJson(nextSite) },
          { path: PATHS.services, text: toJson(nextServices) },
        ];
        if (await save(changes, 'Update Run Club', saveBtn)) toast(savedMessage());
      }) as EventListener,
    },
    words.box,
    h('h2', {}, 'Key facts'),
    h(
      'p',
      { class: 'hint' },
      'Four boxes beside the photos, e.g. “The block / 8 sessions / over 8 weeks”. Leave a box empty to hide it.',
    ),
    h(
      'div',
      { class: 'days' },
      facts.map((f) => f.box),
    ),
    h(
      'fieldset',
      { class: 'box' },
      h('legend', {}, 'Next block'),
      h(
        'p',
        { class: 'hint' },
        'Shown under the price, and on the Run Club plan card. Leave the date empty to hide it.',
      ),
      starts.wrap,
      when.wrap,
      spaces.wrap,
      h('div', { class: 'row-actions' }, clearDates),
    ),
    infoBox(
      'Photos and price',
      `The photos (${club.photos?.length ?? 0} at the moment) are changed in Photos. ` +
        `The price, ${plan.price} ${plan.per}, is changed in Ways to train.`,
      [
        ['Change Run Club photos', '#/photos/runclub'],
        ['Change the price', '#/prices'],
      ],
    ),
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    'Run Club',
    sectionHeading(
      'Run Club',
      'The Run Club section of your home page, and the dates on the Run Club card.',
      '#runclub',
    ),
    summary,
    form,
  );
}
