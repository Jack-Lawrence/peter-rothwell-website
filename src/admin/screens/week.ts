// The "typical week" strip under the headline.
import { h, field, textInput, Errors, errorSummary, toast } from '../ui';
import { PATHS, type Week, readJson, toJson, save, savedMessage, screen, trackDirty } from '../app';
import { sectionHeading } from './website';

// ---------- Week strip ----------

export async function weekScreen() {
  const week = await readJson<Week>(PATHS.week);
  const summary = errorSummary();
  const title = field('Heading', textInput(week.title, { maxlength: 50 }));
  const days = week.days.map((d) => {
    const session = field(`${d.day}: session`, textInput(d.session, { maxlength: 20 }), 'Short, e.g. "Easy 8 km"');
    const note = field(`${d.day}: note`, textInput(d.note, { maxlength: 40 }), 'e.g. "Zone 2, conversational"');
    const highlight = h('input', { type: 'checkbox', id: `hl-${d.day}`, checked: !!d.highlight });
    return {
      d,
      session,
      note,
      highlight,
      box: h(
        'fieldset',
        { class: 'box day' },
        h('legend', {}, d.day),
        session.wrap,
        note.wrap,
        h('label', { class: 'check', for: highlight.id }, highlight, h('span', {}, 'Highlight in yellow')),
      ),
    };
  });
  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save week');
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        if (!title.input.value.trim()) errors.add(title, 'Add a heading for the week.');
        for (const r of days) {
          if (!r.session.input.value.trim()) errors.add(r.session, `${r.d.day}: add a session, or "Rest".`);
          else if (r.session.input.value.trim().length > 14)
            errors.add(r.session, `${r.d.day}: keep the session to 14 characters so it fits.`);
          if (r.note.input.value.trim().length > 30)
            errors.add(r.note, `${r.d.day}: keep the note to 30 characters so it fits.`);
        }
        if (!errors.show()) return;
        const next: Week = {
          title: title.input.value.trim(),
          days: days.map((r) => ({
            day: r.d.day,
            session: r.session.input.value.trim(),
            note: r.note.input.value.trim(),
            ...(r.highlight.checked ? { highlight: true } : {}),
          })),
        };
        if (await save([{ path: PATHS.week, text: toJson(next) }], 'Update typical week', saveBtn))
          toast(savedMessage());
      }) as EventListener,
    },
    h('div', { class: 'box' }, title.wrap),
    h(
      'div',
      { class: 'days' },
      days.map((r) => r.box),
    ),
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    'Typical week',
    sectionHeading('Typical week', 'The week of training shown under the big headline on your home page.', ''),
    summary,
    form,
  );
}
