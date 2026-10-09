// The policy pages: privacy, terms, refunds and accessibility.
import { h, field, textArea, Errors, errorSummary, toast, formatDate, today } from '../ui';
import { parseDoc, stringifyDoc, markdownToHtml } from '../markdown';
import { placeholders } from '../todo';
import { PATHS, store, save, savedMessage, screen, heading, trackDirty } from '../app';

// ---------- Policies ----------

export async function policiesList() {
  const names = (await store!.list(PATHS.legal)).filter((n) => n.endsWith('.md'));
  const docs = await Promise.all(
    names.map(async (n) => {
      const { data, body } = parseDoc((await store!.read(`${PATHS.legal}/${n}`)) ?? '');
      return { id: n.replace(/\.md$/, ''), data, todo: placeholders(body).length };
    }),
  );
  docs.sort((a, b) => Number(a.data.order ?? 0) - Number(b.data.order ?? 0));
  screen(
    'Policies',
    heading('Policies', 'Your privacy policy, terms, refunds and accessibility pages.'),
    h(
      'section',
      { class: 'box' },
      h(
        'ul',
        { class: 'rows' },
        docs.map((d) =>
          h(
            'li',
            {},
            h(
              'a',
              { class: 'row', href: `#/policy/${d.id}` },
              h(
                'span',
                { class: 'row-text' },
                h('b', {}, String(d.data.title)),
                h('span', { class: 'sub' }, `Last updated ${formatDate(String(d.data.updated))}`),
              ),
              d.todo
                ? h('span', { class: 'pill pill--draft' }, `${d.todo} to fill in`)
                : h('span', { class: 'pill pill--live' }, 'Complete'),
            ),
          ),
        ),
      ),
    ),
  );
}

export async function policyEditor(id: string) {
  const path = `${PATHS.legal}/${id}.md`;
  const text = await store!.read(path);
  if (text === null) {
    screen('Not found', heading('Page not found', undefined, ['#/policies', 'All policies']));
    return;
  }
  const { data, body } = parseDoc(text);
  const summary = errorSummary();
  const area = textArea(body, { rows: 24, spellcheck: true, class: 'md-input' });
  const editorField = field(
    'Page text',
    area,
    'Written in Markdown: ## for a heading, - for a bullet point, **bold**.',
  );
  const preview = h('div', { class: 'site-post site-post--legal', 'aria-live': 'off' });
  const todo = h('div', { class: 'todo' });

  const refresh = () => {
    preview.innerHTML = markdownToHtml(area.value);
    const marks = placeholders(area.value);
    todo.replaceChildren();
    if (!marks.length) {
      todo.append(h('p', { class: 'ok' }, 'Nothing left to fill in on this page.'));
      return;
    }
    todo.append(
      h(
        'p',
        {},
        h('b', {}, marks.length === 1 ? '1 thing still to fill in:' : `${marks.length} things still to fill in:`),
      ),
      h(
        'ul',
        {},
        marks.map((m) =>
          h(
            'li',
            {},
            h(
              'button',
              {
                type: 'button',
                class: 'link',
                onclick: (() => {
                  const needle = `<mark>${m}</mark>`;
                  const at = area.value.indexOf(needle);
                  if (at < 0) return;
                  area.focus();
                  area.setSelectionRange(at, at + needle.length);
                }) as EventListener,
              },
              m.replace(/^\[|\]$/g, ''),
            ),
          ),
        ),
      ),
      h(
        'p',
        { class: 'hint' },
        'Tap one to jump to it, then replace the whole highlighted part (including <mark> and </mark>) with the real details.',
      ),
    );
  };
  area.addEventListener('input', refresh);
  refresh();

  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save page');
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        if (area.value.trim().length < 100)
          errors.add(editorField, 'This page looks almost empty. Undo your changes or add the text back.');
        const opens = (area.value.match(/<mark>/g) ?? []).length;
        const closes = (area.value.match(/<\/mark>/g) ?? []).length;
        if (opens !== closes)
          errors.add(
            editorField,
            'A highlight is only half removed. Delete both <mark> and </mark> around the text you filled in.',
          );
        if (!errors.show()) return;
        const next = stringifyDoc({ ...data, updated: today() }, area.value);
        if (await save([{ path, text: next }], `Update ${String(data.title).toLowerCase()}`, saveBtn))
          toast(savedMessage());
      }) as EventListener,
    },
    h(
      'div',
      { class: 'split' },
      h('div', { class: 'box' }, editorField.wrap),
      h('div', { class: 'box' }, h('span', { class: 'label' }, 'Preview'), preview),
    ),
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    String(data.title),
    heading(String(data.title), String(data.description ?? ''), ['#/policies', 'All policies']),
    summary,
    todo,
    form,
  );
}
