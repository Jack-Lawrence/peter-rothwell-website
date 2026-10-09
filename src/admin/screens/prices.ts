// Ways to train: plans and prices.
import { h, field, textInput, textArea, Errors, errorSummary, toast, dialog, type Field } from '../ui';
import { type Change } from '../store';
import { slugify } from '../markdown';
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
  trackDirty,
} from '../app';
import { type Site, sectionHeading } from './website';

// ---------- Ways to train (plans and prices) ----------

export const MAX_PLANS = 4;

export async function pricesScreen() {
  const [services, site, testimonials] = await Promise.all([
    readJson<Service[]>(PATHS.services),
    readJson<Site>(PATHS.site),
    readJson<Testimonial[]>(PATHS.testimonials),
  ]);
  const summary = errorSummary();
  const list = h('div', { class: 'stack' });

  type Row = { s: Service; name: Field; label: Field; price: Field; per: Field; points: Field; box: HTMLElement };
  let rows: Row[] = [];
  const makeRow = (s: Service): Row => {
    const name = field('Name', textInput(s.name, { maxlength: 40 }));
    const label = field(
      'Small label above the name',
      textInput(s.label, { maxlength: 40 }),
      'e.g. "Online" or "Group · Weekly"',
    );
    const price = field(
      'Price (£)',
      textInput(s.price.replace(/^£/, ''), { inputmode: 'decimal', maxlength: 8, class: 'price-input' }),
    );
    const per = field('Per', textInput(s.per.replace(/^\/\s*/, ''), { maxlength: 20 }), 'e.g. "month" or "8 weeks"');
    const points = field(
      'What’s included',
      textArea(s.points.join('\n'), { rows: 4 }),
      'One point per line. Three or four short points work best.',
    );
    const isClub = s.id === 'runclub';
    const row: Row = { s, name, label, price, per, points, box: h('fieldset', { class: 'box' }) };
    row.box.append(
      h('legend', {}, s.name || 'New plan'),
      isClub ? h('p', { class: 'hint' }, 'This plan is linked to your Run Club section, so it can’t be removed.') : '',
      name.wrap,
      label.wrap,
      h('div', { class: 'pair' }, price.wrap, per.wrap),
      points.wrap,
      h(
        'div',
        { class: 'row-actions' },
        h(
          'button',
          { type: 'button', class: 'btn btn--small', onclick: (() => move(row, -1)) as EventListener },
          'Move left',
        ),
        h(
          'button',
          { type: 'button', class: 'btn btn--small', onclick: (() => move(row, 1)) as EventListener },
          'Move right',
        ),
        !isClub &&
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn--small btn--danger',
              onclick: (async () => {
                const answer = await dialog(
                  `Remove ${row.name.input.value.trim() || 'this plan'}?`,
                  [h('p', {}, 'It comes off your website when you press Save. You can add it again later.')],
                  [
                    { label: 'Keep it', value: '' },
                    { label: 'Remove plan', value: 'remove', primary: true },
                  ],
                );
                if (answer !== 'remove') return;
                rows = rows.filter((r) => r !== row);
                draw();
                setDirty(true);
              }) as EventListener,
            },
            'Remove plan',
          ),
      ),
    );
    return row;
  };
  const move = (row: Row, by: number) => {
    const i = rows.indexOf(row);
    const j = i + by;
    if (j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    draw();
    setDirty(true);
  };
  const addBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn',
      onclick: (() => {
        const row = makeRow({ id: '', label: '', name: '', price: '', per: 'month', points: [] });
        rows.push(row);
        draw();
        setDirty(true);
        row.name.input.focus();
      }) as EventListener,
    },
    '+ Add a plan',
  );
  const draw = () => {
    list.replaceChildren(...rows.map((r) => r.box));
    addBtn.hidden = rows.length >= MAX_PLANS;
  };
  rows = services.map(makeRow);
  draw();

  const heads = textGroup(site, 'Heading', [
    { path: 'coaching.title', label: 'Heading', max: 40 },
    { path: 'coaching.intro', label: 'Introduction', kind: 'text', max: 250 },
  ]);
  const extras = textGroup(site, 'Under the plans', [
    {
      path: 'coaching.enquire',
      label: 'Button on each plan',
      max: 20,
      hint: 'It goes to the enquiry form, with that plan picked.',
    },
    {
      path: 'coaching.more',
      label: 'Second button on the Run Club plan',
      max: 14,
      hint: 'One word works best, e.g. “Details”. It goes to the Run Club section.',
    },
    {
      path: 'coaching.inPersonLabel',
      label: 'Label above your address',
      max: 30,
      hint: 'Your address and map come from Contact details.',
    },
    { path: 'coaching.onlineLabel', label: 'Label for online training', max: 30 },
    { path: 'coaching.onlineTitle', label: 'Online heading', max: 30 },
    { path: 'coaching.onlineText', label: 'Online text', kind: 'text', max: 160 },
  ]);

  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save changes');
  const lines = (f: Field) =>
    f.input.value
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean);
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        heads.check(errors);
        if (!rows.length) errors.add(addBtn, 'Add at least one plan.');
        const names = new Set<string>();
        rows.forEach((r, i) => {
          const n = r.name.input.value.trim();
          const who = n || `Plan ${i + 1}`;
          if (!n) errors.add(r.name, `Plan ${i + 1}: give it a name.`);
          else if (names.has(n.toLowerCase())) errors.add(r.name, `${n}: two plans have this name. Give each its own.`);
          names.add(n.toLowerCase());
          if (!/^\d+(\.\d{1,2})?$/.test(r.price.input.value.trim()))
            errors.add(r.price, `${who}: the price should be a number, like 80 or 79.50.`);
          if (!r.per.input.value.trim()) errors.add(r.per, `${who}: say what the price is per, like "month".`);
          const pts = lines(r.points);
          if (pts.length === 0) errors.add(r.points, `${who}: add at least one thing that’s included.`);
          else if (pts.length > 6) errors.add(r.points, `${who}: keep it to 6 points or fewer so the cards stay tidy.`);
          else if (pts.some((p) => p.length > 70)) errors.add(r.points, `${who}: keep each point under 70 characters.`);
        });
        extras.check(errors);
        if (!errors.show()) return;

        // New plans get an id from their name (used for links); existing ones keep theirs.
        const ids = new Set(rows.map((r) => r.s.id).filter(Boolean));
        const next: Service[] = rows.map((r) => {
          let id = r.s.id;
          if (!id) {
            const base = slugify(r.name.input.value) || 'plan';
            id = base;
            for (let n = 2; ids.has(id) || id === 'runclub'; n++) id = `${base}-${n}`;
            ids.add(id);
          }
          return {
            ...r.s,
            id,
            label: r.label.input.value.trim(),
            name: r.name.input.value.trim(),
            price: `£${r.price.input.value.trim()}`,
            per: `/ ${r.per.input.value.trim()}`,
            points: lines(r.points),
          };
        });
        const changes: Change[] = [
          { path: PATHS.services, text: toJson(next) },
          { path: PATHS.site, text: toJson(extras.apply(heads.apply(site))) },
        ];
        // A renamed plan: reviews that named it follow the new name.
        const renamed = new Map(
          services.flatMap((old) => {
            const now = next.find((s) => s.id === old.id);
            return now && now.name !== old.name ? [[old.name, now.name] as const] : [];
          }),
        );
        if (renamed.size && testimonials.some((t) => renamed.has(t.service))) {
          const updated = testimonials.map((t) => ({ ...t, service: renamed.get(t.service) ?? t.service }));
          changes.push({ path: PATHS.testimonials, text: toJson(updated) });
        }
        if (await save(changes, 'Update Ways to train', saveBtn)) {
          toast(savedMessage());
          route();
        }
      }) as EventListener,
    },
    heads.box,
    h('h2', {}, 'Your plans'),
    h('p', { class: 'hint' }, `Up to ${MAX_PLANS} plans, shown side by side in this order.`),
    list,
    addBtn,
    extras.box,
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    'Ways to train',
    sectionHeading('Ways to train', 'Your plans and prices, and where you train people.', '#coaching'),
    summary,
    form,
  );
}
