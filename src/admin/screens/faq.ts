// Questions (FAQ) near the bottom of the home page.
import { h, field, textInput, textArea, Errors, errorSummary, toast, type Field } from '../ui';
import { type Change } from '../store';
import { textGroup } from '../text-fields';
import { PATHS, readJson, toJson, save, savedMessage, setDirty, screen, trackDirty } from '../app';
import { type Site, sectionHeading } from './website';

// ---------- Questions (FAQ) ----------

export interface Faq {
  question: string;
  answer: string;
}
export const MAX_FAQS = 12;
// Notes still to fill in are saved as <mark>[Peter to confirm: …]</mark>. In the
// editor they show as plain [Peter to confirm: …] so they're easy to read and replace.
export const fromMarks = (s: string) => s.replace(/<mark>([\s\S]*?)<\/mark>/g, '$1');
export const toMarks = (s: string) => s.replace(/\[Peter to confirm:[^\]]*\]/g, (m) => `<mark>${m}</mark>`);

export async function faqScreen() {
  const [items, site] = await Promise.all([readJson<Faq[]>(PATHS.faq), readJson<Site>(PATHS.site)]);
  const summary = errorSummary();
  const heads = textGroup(site, 'Heading', [
    { path: 'faq.eyebrow', label: 'Small heading', max: 40 },
    { path: 'faq.title', label: 'Big heading', max: 30, hint: 'Also used for the link at the bottom of every page.' },
  ]);
  const list = h('div', { class: 'stack' });
  type Row = { question: Field; answer: Field; box: HTMLElement };
  let rows: Row[] = [];
  const makeRow = (f: Faq): Row => {
    const question = field('Question', textInput(f.question, { maxlength: 120 }));
    const todo = /\[Peter to confirm:/.test(fromMarks(f.answer));
    const answer = field(
      'Your answer',
      textArea(fromMarks(f.answer), { rows: 4, maxlength: 800 }),
      todo ? 'Replace the part in [square brackets] with your answer.' : undefined,
    );
    const row: Row = { question, answer, box: h('fieldset', { class: 'box' }) };
    row.box.append(
      h('legend', {}, 'Question'),
      question.wrap,
      answer.wrap,
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
        const row = makeRow({ question: '', answer: '' });
        rows.push(row);
        draw();
        setDirty(true);
        row.question.input.focus();
      }) as EventListener,
    },
    '+ Add a question',
  );
  const draw = () => {
    list.replaceChildren(...(rows.length ? rows.map((r) => r.box) : [h('p', {}, 'No questions yet.')]));
    rows.forEach((r, i) => (r.box.querySelector('legend')!.textContent = `Question ${i + 1}`));
    addBtn.hidden = rows.length >= MAX_FAQS;
  };
  rows = items.map(makeRow);
  draw();

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
          if (!r.question.input.value.trim()) errors.add(r.question, `Question ${i + 1}: write the question.`);
          if (!r.answer.input.value.trim()) errors.add(r.answer, `Question ${i + 1}: write your answer.`);
        });
        if (!errors.show()) return;
        const next: Faq[] = rows.map((r) => ({
          question: r.question.input.value.trim(),
          answer: toMarks(r.answer.input.value.replace(/\s+/g, ' ').trim()),
        }));
        const changes: Change[] = [
          { path: PATHS.faq, text: toJson(next) },
          { path: PATHS.site, text: toJson(heads.apply(site)) },
        ];
        if (await save(changes, 'Update questions', saveBtn)) toast(savedMessage());
      }) as EventListener,
    },
    heads.box,
    h('h2', {}, 'Questions and answers'),
    h('p', { class: 'hint' }, 'People tap a question to see your answer. They show in this order.'),
    list,
    addBtn,
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    'Questions',
    sectionHeading('Questions', 'Common questions near the bottom of your home page, with your answers.', '#faq'),
    summary,
    form,
  );
}
