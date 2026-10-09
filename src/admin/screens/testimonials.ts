// Testimonials: add, edit, reorder and remove them.
import { h, field, textInput, textArea, Errors, errorSummary, toast, today, type Field } from '../ui';
import { type Change } from '../store';
import { textGroup } from '../text-fields';
import {
  PATHS,
  type Service,
  type Testimonial,
  readJson,
  toJson,
  save,
  savedMessage,
  setDirty,
  screen,
  route,
  setLastHash,
  trackDirty,
} from '../app';
import { type Site, sectionHeading } from './website';

// ---------- Testimonials ----------

export async function testimonialsScreen(arg: string) {
  const [items, services, site] = await Promise.all([
    readJson<Testimonial[]>(PATHS.testimonials),
    readJson<Service[]>(PATHS.services),
    readJson<Site>(PATHS.site),
  ]);
  const summary = errorSummary();
  const heads = textGroup(site, 'Heading', [
    { path: 'reviews.eyebrow', label: 'Small heading', max: 40 },
    {
      path: 'reviews.title',
      label: 'Big heading',
      max: 30,
      hint: 'Also used for the link at the bottom of every page.',
    },
  ]);
  const list = h('div', { class: 'stack' });
  type Row = {
    name: Field;
    service: Field;
    quote: Field;
    started: Field;
    ongoing: HTMLInputElement;
    ended: Field;
    consent: HTMLInputElement;
    consentWrap: HTMLElement;
    box: HTMLElement;
  };
  let rows: Row[] = [];

  const makeRow = (t: Testimonial, isNew = false): Row => {
    const name = field('Client’s first name', textInput(t.name, { maxlength: 40, autocomplete: 'off' }));
    const select = h(
      'select',
      {},
      h('option', { value: '' }, 'Choose one'),
      [...services.map((s) => s.name), 'Online coaching', 'Personal training', 'Run Club']
        .filter((v, i, a) => a.indexOf(v) === i)
        .map((n) => h('option', { value: n }, n)),
    );
    if (t.service && ![...select.options].some((o) => o.value === t.service))
      select.append(h('option', { value: t.service }, t.service));
    select.value = t.service;
    const service = field('What they did with you', select);
    const quote = field(
      'What they said',
      textArea(t.quote, { rows: 4, maxlength: 600 }),
      'Paste their words exactly as they wrote them.',
    );
    // How long they've trained together: shown on the site as "Client for 4 months".
    const started = field(
      'Started training with you (optional)',
      h('input', { type: 'date', value: t.started ?? '', max: today() }),
      'Shows how long they’ve been your client, e.g. “Client for 4 months”. Leave blank to hide it.',
    );
    const ongoing = h('input', {
      type: 'checkbox',
      id: `ongoing-${Math.random().toString(36).slice(2)}`,
      checked: !t.ended || t.ended === 'ongoing',
    });
    const ended = field(
      'Finished on',
      h('input', { type: 'date', value: t.ended && t.ended !== 'ongoing' ? t.ended : '', max: today() }),
    );
    const showEnded = () => {
      ended.wrap.hidden = ongoing.checked;
    };
    ongoing.addEventListener('change', showEnded);
    showEnded();
    const consent = h('input', {
      type: 'checkbox',
      id: `consent-${Math.random().toString(36).slice(2)}`,
      checked: !!t.consent,
    });
    const consentWrap = h(
      'label',
      { class: 'check', for: consent.id },
      consent,
      h('span', {}, 'Client agreed to this being published'),
    );
    const box: HTMLElement = h(
      'fieldset',
      { class: 'box' },
      h('legend', {}, isNew ? 'New testimonial' : t.name || 'Testimonial'),
      name.wrap,
      service.wrap,
      quote.wrap,
      started.wrap,
      h(
        'label',
        { class: 'check', for: ongoing.id },
        ongoing,
        h('span', {}, 'Still training with me (the time keeps counting up by itself)'),
      ),
      ended.wrap,
      consentWrap,
      h(
        'div',
        { class: 'row-actions' },
        h(
          'button',
          { type: 'button', class: 'btn btn--small', onclick: (() => move(row, -1)) as EventListener },
          'Move up',
        ),
        h(
          'button',
          { type: 'button', class: 'btn btn--small', onclick: (() => move(row, 1)) as EventListener },
          'Move down',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--small btn--danger',
            onclick: (() => {
              rows = rows.filter((r) => r !== row);
              draw();
              setDirty(true);
            }) as EventListener,
          },
          'Remove',
        ),
      ),
    );
    const row = { name, service, quote, started, ongoing, ended, consent, consentWrap, box };
    return row;
  };
  const move = (row: Row, by: number) => {
    const i = rows.indexOf(row);
    const j = i + by;
    if (j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    draw();
    setDirty(true);
    row.box.querySelector('button')?.focus();
  };
  const draw = () =>
    list.replaceChildren(...(rows.length ? rows.map((r) => r.box) : [h('p', {}, 'No testimonials yet.')]));

  rows = items.map((t) => makeRow(t));
  draw();
  const addRow = () => {
    const row = makeRow({ name: '', service: '', quote: '' }, true);
    rows.push(row);
    draw();
    row.box.scrollIntoView({ block: 'center' });
    row.name.input.focus();
  };

  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save changes');
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        heads.check(errors);
        rows.forEach((r, i) => {
          const who = r.name.input.value.trim() || `Testimonial ${i + 1}`;
          if (!r.name.input.value.trim()) errors.add(r.name, `Testimonial ${i + 1}: add the client’s first name.`);
          if (!r.service.input.value) errors.add(r.service, `${who}: choose what they did with you.`);
          if (r.quote.input.value.trim().length < 20)
            errors.add(r.quote, `${who}: paste what they said (at least a sentence).`);
          const start = r.started.input.value;
          const end = r.ended.input.value;
          if (start > today()) errors.add(r.started, `${who}: the start date is in the future.`);
          if (start && !r.ongoing.checked) {
            if (!end) errors.add(r.ended, `${who}: choose when they finished, or tick “Still training with me”.`);
            else if (end <= start) errors.add(r.ended, `${who}: the finish date must be after the start date.`);
            else if (end > today())
              errors.add(r.ended, `${who}: the finish date is in the future. Tick “Still training with me” instead.`);
          }
          if (!r.consent.checked)
            errors.add(r.consent, `${who}: tick the box to confirm they agreed to it being published.`);
        });
        if (!errors.show()) return;
        const next: Testimonial[] = rows.map((r) => ({
          name: r.name.input.value.trim(),
          service: r.service.input.value,
          quote: r.quote.input.value.trim(),
          consent: true,
          ...(r.started.input.value && {
            started: r.started.input.value,
            ended: r.ongoing.checked ? 'ongoing' : r.ended.input.value,
          }),
        }));
        const changes: Change[] = [
          { path: PATHS.testimonials, text: toJson(next) },
          { path: PATHS.site, text: toJson(heads.apply(site)) },
        ];
        if (await save(changes, 'Update reviews', saveBtn)) {
          toast(savedMessage());
          history.replaceState(null, '', '#/testimonials');
          setLastHash(location.hash);
          route();
        }
      }) as EventListener,
    },
    heads.box,
    h('h2', {}, 'Reviews'),
    list,
    h(
      'div',
      { class: 'save-bar' },
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn--big',
          onclick: (() => addRow()) as EventListener,
        },
        '+ Add a testimonial',
      ),
      saveBtn,
    ),
  );
  trackDirty(form);
  screen(
    'Reviews',
    sectionHeading(
      'Reviews',
      'Kind words from clients, shown on your home page. Only add ones the client has agreed to share.',
      '#reviews',
    ),
    summary,
    form,
  );
  if (arg === 'new') addRow();
}
