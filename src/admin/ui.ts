// Small DOM helpers for the admin. Text is always set as text, never HTML.

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined | EventListener>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = String(value);
    else if (key in el && typeof value !== 'string') (el as unknown as Record<string, unknown>)[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

let uid = 0;
export const newId = (prefix = 'f') => `${prefix}-${++uid}`;

export interface Field {
  wrap: HTMLElement;
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  error: HTMLElement;
}

/** A labelled input with room for a hint and an error message. */
export function field(
  label: string,
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  hint?: string,
): Field {
  input.id ||= newId();
  const hintEl = hint ? h('p', { class: 'hint', id: `${input.id}-hint` }, hint) : null;
  const error = h('p', { class: 'field-error', id: `${input.id}-error`, hidden: true });
  input.setAttribute('aria-describedby', [hintEl?.id, error.id].filter(Boolean).join(' '));
  const wrap = h('div', { class: 'field' }, h('label', { for: input.id }, label), hintEl, input, error);
  return { wrap, input, error };
}

export const textInput = (value = '', attrs: Attrs = {}) => h('input', { type: 'text', value, ...attrs });
export const textArea = (value = '', attrs: Attrs = {}) => {
  const el = h('textarea', attrs);
  el.value = value;
  return el;
};

/** Collects errors for a form, shows them next to each field and in a summary at the top. */
export class Errors {
  private list: { field: Field | HTMLElement; message: string }[] = [];
  constructor(private summary: HTMLElement) {}

  add(target: Field | HTMLElement, message: string) {
    this.list.push({ field: target, message });
  }

  get count() {
    return this.list.length;
  }

  messageFor(target: Field | HTMLElement) {
    return this.list.find((e) => e.field === target)?.message;
  }

  /** Shows the errors. Returns true when there were none. */
  show(): boolean {
    document.querySelectorAll('.field-error').forEach((el) => ((el as HTMLElement).hidden = true));
    document.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    this.summary.replaceChildren();
    this.summary.hidden = this.list.length === 0;
    if (this.list.length === 0) return true;

    const items = this.list.map(({ field: f, message }) => {
      const input = 'input' in f ? f.input : f;
      if ('error' in f) {
        f.error.textContent = message;
        f.error.hidden = false;
      }
      input.setAttribute('aria-invalid', 'true');
      return h(
        'li',
        {},
        h(
          'a',
          {
            href: `#${input.id}`,
            onclick: ((e: Event) => {
              e.preventDefault();
              input.focus();
            }) as EventListener,
          },
          message,
        ),
      );
    });
    this.summary.append(
      h(
        'h2',
        {},
        this.list.length === 1 ? 'Please fix this first:' : `Please fix these ${this.list.length} things first:`,
      ),
      h('ul', {}, items),
    );
    this.summary.focus();
    return false;
  }
}

export function errorSummary() {
  return h('div', { class: 'error-summary', role: 'alert', tabindex: -1, hidden: true });
}

/** A short message that appears at the bottom of the screen. */
export function toast(message: string, kind: 'ok' | 'error' = 'ok') {
  const region = document.getElementById('toasts')!;
  const el = h('div', { class: `toast toast--${kind}` }, message);
  region.replaceChildren(el);
  setTimeout(() => el.remove(), kind === 'ok' ? 6000 : 10000);
}

/** Simple modal dialog. Resolves with the value of the button pressed (or '' if closed). */
export function dialog(
  title: string,
  body: (Node | string)[],
  buttons: { label: string; value: string; primary?: boolean }[],
) {
  return new Promise<string>((resolve) => {
    const dlg = h(
      'dialog',
      { class: 'dlg', 'aria-labelledby': 'dlg-title' },
      h('h2', { id: 'dlg-title' }, title),
      ...body,
      h(
        'div',
        { class: 'dlg-actions' },
        buttons.map((b) =>
          h(
            'button',
            {
              type: 'button',
              class: b.primary ? 'btn btn--primary' : 'btn',
              onclick: (() => {
                dlg.close(b.value);
              }) as EventListener,
            },
            b.label,
          ),
        ),
      ),
    );
    dlg.addEventListener('close', () => {
      resolve(dlg.returnValue);
      dlg.remove();
    });
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function relativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
