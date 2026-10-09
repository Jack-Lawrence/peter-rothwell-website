// What the content files must contain for the site to build: the fields each
// component reads, with the right type. Used by the unit tests (on the files in
// the repo) and by the admin area, which checks a change against these rules
// before saving it, so a save from Peter can't break the build.
//
// Posts and policies mirror the schemas in src/content.config.ts (zod, which the
// admin doesn't load); tests/unit/content-rules.test.ts keeps the two in step.
// Keep this file free of anything browser- or Astro-specific.

type Rule =
  | { kind: 'text'; optional: boolean }
  | { kind: 'bool'; optional: boolean }
  | { kind: 'list'; of: Rule; min: number }
  | { kind: 'obj'; fields: Record<string, Rule>; optional: boolean }
  | { kind: 'any' };

/** Text. Required text can't be empty; optional text may be empty or missing. */
const text = (optional = false): Rule => ({ kind: 'text', optional });
const bool = (optional = false): Rule => ({ kind: 'bool', optional });
const list = (of: Rule, min = 0): Rule => ({ kind: 'list', of, min });
const obj = (fields: Record<string, Rule>, optional = false): Rule => ({ kind: 'obj', fields, optional });
const any: Rule = { kind: 'any' };

const photo = obj({ image: text(), alt: text() });

/** Problems with `value`, each as "path: what's wrong". */
export function checkShape(value: unknown, rule: Rule, path = ''): string[] {
  const at = path || 'the file';
  const missing = value === undefined || value === null;
  switch (rule.kind) {
    case 'any':
      return [];
    case 'text':
      if (missing || value === '') return rule.optional ? [] : [`${at}: is empty`];
      return typeof value === 'string' ? [] : [`${at}: should be text`];
    case 'bool':
      if (missing) return rule.optional ? [] : [`${at}: is missing`];
      return typeof value === 'boolean' ? [] : [`${at}: should be true or false`];
    case 'list':
      if (!Array.isArray(value)) return [`${at}: should be a list`];
      if (value.length < rule.min) return [`${at}: needs at least ${rule.min}`];
      return value.flatMap((v, i) => checkShape(v, rule.of, `${path}[${i + 1}]`));
    case 'obj':
      if (missing) return rule.optional ? [] : [`${at}: is missing`];
      if (typeof value !== 'object' || Array.isArray(value)) return [`${at}: is the wrong shape`];
      return Object.entries(rule.fields).flatMap(([k, r]) =>
        checkShape((value as Record<string, unknown>)[k], r, path ? `${path}.${k}` : k),
      );
  }
}

// ---------- Data files (src/data/*.json) ----------

const site = obj({
  name: text(),
  description: text(),
  nav: obj({ coaching: text(), runClub: text(), about: text(), journal: text(), cta: text() }),
  footer: obj({ text: text() }),
  carousel: obj({ next: text(), pause: text(), play: text() }),
  hero: obj({
    eyebrow: text(),
    headline: list(text(), 1),
    intro: text(),
    badge: obj({ label: text(true), value: text(true) }),
    photos: list(photo),
    photosLabel: text(),
    buttons: obj({ primary: text(), secondary: text() }),
  }),
  coaching: obj({
    title: text(),
    intro: text(),
    enquire: text(),
    more: text(),
    inPersonLabel: text(),
    onlineLabel: text(),
    onlineTitle: text(),
    onlineText: text(),
  }),
  runClub: obj({
    eyebrow: text(),
    headline: text(),
    paragraphs: list(text()),
    facts: list(obj({ label: text(true), value: text(true), note: text(true) })),
    button: text(),
    photos: list(photo),
    photosLabel: text(),
  }),
  about: obj({
    eyebrow: text(),
    name: text(),
    paragraphs: list(text()),
    stats: list(obj({ value: text(true), label: text(true) })),
    photo: obj({ image: text(), alt: text() }),
  }),
  reviews: obj({ eyebrow: text(), title: text() }),
  instagram: obj({ eyebrow: text(), button: text() }),
  journal: obj({ title: text(), intro: text(), allPosts: text(), sampleLabel: text() }),
  faq: obj({ eyebrow: text(), title: text() }),
  getInTouch: obj({
    eyebrow: text(),
    title: text(),
    intro: text(),
    formTitle: text(),
    formIntro: text(),
    placeholder: text(),
    note: text(),
    button: text(),
    thanks: text(),
  }),
  contact: obj({ phone: text(), email: text(), instagram: text() }),
  enquiries: obj({ accessKey: text(true), captcha: bool(), interests: list(text()) }),
  location: obj({
    area: text(),
    place: text(),
    address: text(),
    street: text(),
    locality: text(),
    postcode: text(),
    mapsUrl: text(),
  }),
});

const services = list(
  obj({
    id: text(),
    label: text(),
    name: text(),
    price: text(),
    per: text(true),
    points: list(text()),
    schedule: obj({ starts: text(true), when: text(true), spaces: text(true) }, true),
  }),
  1,
);

const testimonials = list(
  obj({
    name: text(),
    service: text(true),
    quote: text(),
    consent: bool(true),
    started: text(true),
    ended: text(true),
  }),
);

const week = obj({
  title: text(),
  days: list(obj({ day: text(), session: text(), note: text(true), highlight: bool(true) }), 1),
});

const faq = list(obj({ question: text(), answer: text() }));

const theme = obj({ preset: text(), custom: any });

const instagram = obj({ updated: any, posts: list(any) });

/** Each data file, with a plain name for messages. */
export const DATA_FILES: Record<string, { name: string; rule: Rule }> = {
  'src/data/site.json': { name: 'your website’s wording', rule: site },
  'src/data/services.json': { name: 'your plans and prices', rule: services },
  'src/data/testimonials.json': { name: 'your testimonials', rule: testimonials },
  'src/data/week.json': { name: 'the typical week', rule: week },
  'src/data/faq.json': { name: 'your questions', rule: faq },
  'src/data/theme.json': { name: 'your colours', rule: theme },
  'src/data/instagram.json': { name: 'the Instagram feed', rule: instagram },
};

/** Checks a data file's text. Returns the problems found (none means it's fine). */
export function checkDataFile(path: string, json: string): string[] {
  const spec = DATA_FILES[path];
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return [`${spec?.name ?? path}: the file isn’t valid JSON`];
  }
  if (!spec) return [];
  return checkShape(value, spec.rule).map((p) => `${spec.name}: ${p}`);
}

// ---------- Posts and policies (src/content/*/*.md) ----------

const isDate = (v: unknown) =>
  v instanceof Date
    ? !Number.isNaN(v.valueOf())
    : (typeof v === 'string' || typeof v === 'number') && !Number.isNaN(new Date(v).valueOf());
const isText = (v: unknown) => typeof v === 'string' && v.trim() !== '';
const optional = (v: unknown, test: (v: unknown) => boolean) => v === undefined || v === '' || test(v);

/** A blog post's front matter, as content.config.ts requires. Messages are for Peter. */
export function checkPost(front: Record<string, unknown>): string[] {
  const problems: string[] = [];
  if (!isText(front.title)) problems.push('The post needs a title.');
  if (!isDate(front.date)) problems.push('The post needs a date.');
  if (!isText(front.topic)) problems.push('The post needs a topic.');
  if (!isText(front.excerpt)) problems.push('The post needs a short summary.');
  if (
    !optional(front.cover, (v) => typeof v === 'string' && /^\.\.\/\.\.\/assets\/.+\.(jpe?g|png|webp|avif)$/i.test(v))
  )
    problems.push('The cover photo is missing or isn’t a photo. Choose it again.');
  if (!optional(front.coverAlt, (v) => typeof v === 'string'))
    problems.push('The cover photo’s description should be text.');
  if (!optional(front.draft, (v) => typeof v === 'boolean')) problems.push('The post’s draft setting is broken.');
  if (!optional(front.sample, (v) => typeof v === 'boolean')) problems.push('The post’s example setting is broken.');
  return problems;
}

/** A policy page's front matter, as content.config.ts requires. */
export function checkPolicy(front: Record<string, unknown>): string[] {
  const problems: string[] = [];
  if (!isText(front.title)) problems.push('The page needs a title.');
  if (!isText(front.description)) problems.push('The page needs a description.');
  if (!isDate(front.updated)) problems.push('The page needs a “last updated” date.');
  if (typeof front.order !== 'number' || Number.isNaN(front.order))
    problems.push('The page’s position in the list is missing.');
  return problems;
}
