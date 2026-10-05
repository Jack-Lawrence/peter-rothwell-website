// Markdown files with a small front matter block, as used by the journal and
// policy pages. The editor works in HTML and saves Markdown.
import { marked } from 'marked';
import TurndownService from 'turndown';

export type FrontValue = string | number | boolean;
export type Front = Record<string, FrontValue>;

/** Splits "---\nkey: value\n---\nbody" into its parts. Handles the simple values these files use. */
export function parseDoc(text: string): { data: Front; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) return { data: {}, body: text };
  const data: Front = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    // Strip a trailing "# comment" from unquoted values.
    const raw = /^["']/.test(m[2]) ? m[2] : m[2].replace(/\s+#.*$/, '');
    data[m[1]] = parseValue(raw);
  }
  return { data, body: match[2].replace(/^\r?\n/, '') };
}

function parseValue(raw: string): FrontValue {
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw.slice(1, -1);
    }
  }
  if (raw.startsWith("'")) return raw.slice(1, -1).replace(/''/g, "'");
  if (raw === 'true' || raw === 'false') return raw === 'true';
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

/** Writes front matter back. Strings are double-quoted (valid YAML), dates stay bare. */
export function stringifyDoc(data: Front, body: string): string {
  const lines = Object.entries(data)
    .filter(([, v]) => v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => {
      if (typeof v !== 'string' || /^\d{4}-\d{2}-\d{2}$/.test(v)) return `${k}: ${v}`;
      if (v.startsWith('../')) return `${k}: ${v}`;
      return `${k}: ${JSON.stringify(v)}`;
    });
  return `---\n${lines.join('\n')}\n---\n\n${body.trim()}\n`;
}

export function markdownToHtml(md: string): string {
  return marked.parse(md, { async: false, gfm: true, breaks: false });
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
});
// Photos keep their path in the repo (data-path); the src is only for showing them here.
turndown.addRule('photo', {
  filter: 'img',
  replacement(_content, node) {
    const img = node as HTMLImageElement;
    const src = img.dataset.path || img.getAttribute('src') || '';
    const alt = (img.getAttribute('alt') || '').replace(/[[\]]/g, '');
    const title = img.getAttribute('title');
    return `![${alt}](${src}${title ? ` "${title.replace(/"/g, "'")}"` : ''})`;
  },
});
// Bold/italic made by the browser's editing commands.
turndown.addRule('bTag', { filter: ['b'], replacement: (c) => (c.trim() ? `**${c}**` : c) });
turndown.addRule('iTag', { filter: ['i'], replacement: (c) => (c.trim() ? `*${c}*` : c) });
// Headings in posts are h2 (the page title is h1).
turndown.addRule('heading', {
  filter: ['h1', 'h2', 'h3'],
  replacement: (c, node) => `\n\n${node.nodeName === 'H3' ? '###' : '##'} ${c.trim()}\n\n`,
});

export function htmlToMarkdown(html: string): string {
  return turndown
    .turndown(html)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Words in a Markdown body, ignoring syntax. */
export function wordCount(md: string): number {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[#*_>`[\]()-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

/** "Why runners should squat!" → "why-runners-should-squat" */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}
