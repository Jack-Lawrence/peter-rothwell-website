// Boxes of wording fields for the "Your website" screens. Each field edits one
// value in site.json, found by a dotted path such as "hero.buttons.primary".
import { h, field, textInput, textArea, type Errors, type Field } from './ui';

type Site = Record<string, unknown>;

export interface TextSpec {
  /** Where the value lives in site.json, e.g. "hero.intro". */
  path: string;
  label: string;
  hint?: string;
  /** Longest allowed, in characters (for a list: each item). */
  max: number;
  /**
   * line: one line of text. text: a few sentences.
   * lines: a list, one per line. paras: paragraphs, with an empty line between.
   */
  kind?: 'line' | 'text' | 'lines' | 'paras';
  /** Most items allowed in a list. */
  most?: number;
  optional?: boolean;
}

export function getPath(site: Site, path: string): unknown {
  return path.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown> | undefined)?.[k], site);
}

/** Returns a copy of `site` with the value at `path` replaced. */
export function setPath(site: Site, path: string, value: unknown): Site {
  const [key, ...rest] = path.split('.');
  const inner = (site[key] ?? {}) as Site;
  return { ...site, [key]: rest.length ? setPath(inner, rest.join('.'), value) : value };
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** A box of fields. `check` adds any problems to `errors`; `apply` writes the values into a copy of site.json. */
export function textGroup(site: Site, legend: string, specs: TextSpec[], intro?: string) {
  const rows = specs.map((spec) => {
    const kind = spec.kind ?? 'line';
    const value = getPath(site, spec.path);
    let input: HTMLInputElement | HTMLTextAreaElement;
    if (kind === 'line') input = textInput(String(value ?? ''), { maxlength: spec.max });
    else if (kind === 'text') input = textArea(String(value ?? ''), { rows: 3, maxlength: spec.max });
    else {
      const items = Array.isArray(value) ? (value as string[]) : [];
      input = textArea(items.join(kind === 'paras' ? '\n\n' : '\n'), { rows: kind === 'paras' ? 8 : 4 });
    }
    const label = spec.optional ? `${spec.label} (optional)` : spec.label;
    return { spec, kind, f: field(label, input, spec.hint) };
  });

  const read = (r: (typeof rows)[number]): string | string[] => {
    const raw = r.f.input.value;
    if (r.kind === 'line' || r.kind === 'text') return squash(raw);
    const parts = r.kind === 'paras' ? raw.split(/\n\s*\n/) : raw.split('\n');
    return parts.map(squash).filter(Boolean);
  };

  return {
    box: h(
      'fieldset',
      { class: 'box' },
      h('legend', {}, legend),
      intro && h('p', { class: 'hint' }, intro),
      rows.map((r) => r.f.wrap),
    ),
    check(errors: Errors) {
      for (const r of rows) {
        const value = read(r);
        const name = r.spec.label;
        if (Array.isArray(value)) {
          if (!value.length && !r.spec.optional) errors.add(r.f, `${name}: this can’t be empty.`);
          else if (r.spec.most && value.length > r.spec.most)
            errors.add(
              r.f,
              `${name}: keep it to ${r.spec.most} ${r.kind === 'paras' ? 'paragraphs' : 'lines'} or fewer.`,
            );
          else if (value.some((v) => v.length > r.spec.max))
            errors.add(
              r.f,
              `${name}: keep each ${r.kind === 'paras' ? 'paragraph' : 'line'} under ${r.spec.max} characters.`,
            );
        } else if (!value && !r.spec.optional) errors.add(r.f, `${name}: this can’t be empty.`);
        else if (value.length > r.spec.max) errors.add(r.f, `${name}: keep it under ${r.spec.max} characters.`);
      }
    },
    apply(next: Site): Site {
      return rows.reduce((s, r) => setPath(s, r.spec.path, read(r)), next);
    },
    fields: rows.map((r) => r.f) as Field[],
  };
}
