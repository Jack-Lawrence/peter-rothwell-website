// The "Still to do" list on the admin's home screen: every "[Peter to confirm: …]"
// placeholder left in the content, example posts still on the website, and a few
// empty optional fields that are worth filling in. Pure functions over the content
// the admin has already loaded, so it works the same in demo and live mode.

export interface TodoItem {
  /** What needs doing, in plain words. */
  text: string;
  /** Which page or section it's on. */
  where: string;
  /** Admin screen where it's fixed, or null when Jack does it. */
  href: string | null;
}

interface Doc {
  data: Record<string, unknown>;
  body: string;
}

export interface TodoInput {
  site: Record<string, unknown>;
  faq: { question: string; answer: string }[];
  services: { name: string }[];
  testimonials: unknown[];
  week: unknown;
  posts: (Doc & { slug: string })[];
  policies: (Doc & { id: string })[];
}

/** The text inside each <mark>…</mark> placeholder. */
export const placeholders = (text: string) => [...text.matchAll(/<mark>([\s\S]*?)<\/mark>/g)].map((m) => m[1]);

const plain = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
const unbracket = (text: string) => text.replace(/^\[\s*/, '').replace(/\s*\]$/, '');
const capital = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);

/**
 * Plain words for the placeholder at position `index` in `text`.
 * "[Peter to confirm: is the chat by phone?]" → "Is the chat by phone?"
 * "give me at least [24 hours'] notice." → "Check: “… give me at least [24 hours'] notice.”"
 * "next block [Peter to confirm]." → "Confirm: “… next block.”"
 */
export function describePlaceholder(text: string, index: number): string {
  const marks = [...text.matchAll(/<mark>([\s\S]*?)<\/mark>/g)];
  const inner = unbracket(plain(marks[index]?.[1] ?? ''));
  const ask = /^Peter to (\w+)\s*(:?)\s*(.*)$/i.exec(inner);
  // A question written for Peter reads fine on its own.
  if (ask && ask[2] && ask[3].endsWith('?')) return capital(ask[3]);

  // Otherwise show the sentence around it. A bare "[Peter to …]" note drops out of
  // the sentence; a suggested value stays in it, in brackets.
  const SPOT = '\u0000';
  let n = 0;
  const marked = text.replace(/<mark>([\s\S]*?)<\/mark>/g, (_, m: string) =>
    n++ === index ? SPOT : `[${unbracket(plain(m))}]`,
  );
  const line = marked.split(/\n/).find((l) => l.includes(SPOT)) ?? '';
  const sentence =
    plain(line.replace(/^\s*(?:[-*+]|\d+\.|#+)\s+/, '').replace(/\*\*|__|\*/g, ''))
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .find((part) => part.includes(SPOT)) ?? '';
  const value = ask && !ask[2] ? '' : ask ? `[${ask[3]}]` : `[${inner}]`;
  const quote = sentence
    .replace(SPOT, value)
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  const label = ask
    ? capital(`${ask[1]} ${ask[2] ? '' : ask[3]}`.replace(/\s+,/g, ',').trim().replace(/[.:]$/, ''))
    : 'Check';
  if (!quote || quote === value) return capital(ask ? (ask[2] ? ask[3] : label) : inner) || 'Something to fill in';
  return `${label}: “${quote}”`;
}

/** Every string inside a JSON value, with the keys leading to it. */
function strings(value: unknown, path: (string | number)[] = []): [(string | number)[], string][] {
  if (typeof value === 'string') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, [...path, i]));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, [...path, k]));
  return [];
}

// Where each part of site.json is edited.
const SITE_SECTIONS: Record<string, [string, string]> = {
  name: ['Menu and footer', '#/menu'],
  description: ['Menu and footer', '#/menu'],
  nav: ['Menu and footer', '#/menu'],
  footer: ['Menu and footer', '#/menu'],
  carousel: ['Menu and footer', '#/menu'],
  hero: ['Top of the home page', '#/hero'],
  coaching: ['Plans and prices', '#/prices'],
  runClub: ['Run Club', '#/runclub'],
  about: ['Meet your coach', '#/about'],
  reviews: ['Testimonials', '#/testimonials'],
  instagram: ['Instagram', '#/instagram'],
  journal: ['Training journal', '#/journal'],
  faq: ['Questions', '#/faq'],
  getInTouch: ['Get in touch', '#/getintouch'],
  enquiries: ['Get in touch', '#/getintouch'],
  contact: ['Contact details', '#/contact'],
  location: ['Contact details', '#/contact'],
};

const describeAll = (text: string) => placeholders(text).map((_, i) => describePlaceholder(text, i));

const fromStrings = (value: unknown, place: (path: (string | number)[]) => [string, string]): TodoItem[] =>
  strings(value).flatMap(([path, text]) => {
    const [where, href] = place(path);
    return describeAll(text).map((words) => ({ text: words, where, href }));
  });

const fromDoc = (doc: Doc, where: string, href: string): TodoItem[] =>
  [...strings(doc.data).map(([, s]) => s), doc.body]
    .flatMap(describeAll)
    .map((words) => ({ text: words, where, href }));

export function findTodos(input: TodoInput): TodoItem[] {
  const { site } = input;
  const items: TodoItem[] = [];

  // Placeholders, page by page.
  items.push(...fromStrings(site, (path) => SITE_SECTIONS[String(path[0])] ?? ['Your website', '#/website']));
  items.push(
    ...fromStrings(input.services, (path) => [
      `Plans and prices: ${input.services[Number(path[0])]?.name ?? ''}`.replace(/: $/, ''),
      '#/prices',
    ]),
  );
  items.push(
    ...fromStrings(input.faq, (path) => [`Questions: “${input.faq[Number(path[0])]?.question ?? ''}”`, '#/faq']),
  );
  items.push(...fromStrings(input.testimonials, () => ['Testimonials', '#/testimonials']));
  items.push(...fromStrings(input.week, () => ['Typical week', '#/week']));
  const policies = [...input.policies].sort((a, b) => Number(a.data.order ?? 0) - Number(b.data.order ?? 0));
  for (const p of policies) items.push(...fromDoc(p, String(p.data.title ?? p.id), `#/policy/${p.id}`));
  for (const p of input.posts)
    items.push(...fromDoc(p, `Blog post: “${String(p.data.title ?? p.slug)}”`, `#/post/${p.slug}`));

  // Example posts Jack wrote for the preview, still on the website.
  for (const p of input.posts) {
    if (p.data.sample === true && p.data.draft !== true)
      items.push({
        text: `Example post still on your website: “${String(p.data.title ?? p.slug)}”. Rewrite it in your words and save it, or delete it.`,
        where: 'Blog posts',
        href: `#/post/${p.slug}`,
      });
  }

  // Empty fields worth filling in.
  const enquiries = site.enquiries as { accessKey?: string } | undefined;
  if (!enquiries?.accessKey)
    items.push({
      text: 'Connect the enquiry form, so enquiries reach your email',
      where: 'Jack will set this up',
      href: null,
    });
  const hero = site.hero as { badge?: { value?: string } } | undefined;
  if (!hero?.badge?.value)
    items.push({
      text: 'Optional: a badge on your top photo, e.g. “Longest run · 100 km”',
      where: 'Top of the home page',
      href: '#/hero',
    });
  const about = site.about as { stats?: { value?: string }[] } | undefined;
  if (!about?.stats?.some((s) => s.value))
    items.push({
      text: 'Optional: up to three numbers about you, e.g. “12 · Ultras finished”',
      where: 'Meet your coach',
      href: '#/about',
    });

  return items;
}
