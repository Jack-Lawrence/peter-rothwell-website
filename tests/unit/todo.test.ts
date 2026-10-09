import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { describePlaceholder, findTodos, placeholders, type TodoInput } from '../../src/admin/todo';
import { parseDoc } from '../../src/admin/markdown';

const json = (file: string) => JSON.parse(readFileSync(`src/data/${file}.json`, 'utf8'));
const docs = (dir: string) =>
  readdirSync(`src/content/${dir}`).map((f) => ({
    name: f.replace(/\.md$/, ''),
    ...parseDoc(readFileSync(`src/content/${dir}/${f}`, 'utf8')),
  }));

const repo = (): TodoInput => ({
  site: json('site'),
  faq: json('faq'),
  services: json('services'),
  testimonials: json('testimonials'),
  week: json('week'),
  posts: docs('journal').map(({ name, ...d }) => ({ slug: name, ...d })),
  policies: docs('legal').map(({ name, ...d }) => ({ id: name, ...d })),
});

describe('describePlaceholder', () => {
  it('shows a question for Peter as it is', () => {
    expect(describePlaceholder('So <mark>[Peter to confirm: is it by phone?]</mark> Then.', 0)).toBe('Is it by phone?');
  });

  it('shows a suggested value in its sentence', () => {
    expect(describePlaceholder("- Give me at least <mark>[24 hours']</mark> notice. More.", 0)).toBe(
      "Check: “Give me at least [24 hours'] notice.”",
    );
  });

  it('drops a bare note from the sentence it applies to', () => {
    expect(describePlaceholder('First. Sessions don’t carry over <mark>[Peter to confirm]</mark>.', 0)).toBe(
      'Confirm: “Sessions don’t carry over.”',
    );
    expect(describePlaceholder('I hold insurance <mark>[Peter to confirm insurer]</mark>.', 0)).toBe(
      'Confirm insurer: “I hold insurance.”',
    );
  });

  it('uses the note itself when it stands alone', () => {
    expect(describePlaceholder('<mark>[Peter to confirm these periods.]</mark>', 0)).toBe('Confirm these periods');
    expect(describePlaceholder('<mark>[Peter to confirm: which race this was]</mark>', 0)).toBe('Which race this was');
  });
});

describe('findTodos', () => {
  it('lists every placeholder in the content', () => {
    const input = repo();
    const marks = [
      ...['site', 'faq', 'services', 'testimonials', 'week'].map((f) => readFileSync(`src/data/${f}.json`, 'utf8')),
      ...[...input.posts, ...input.policies].map((d) => `${JSON.stringify(d.data)}${d.body}`),
    ].flatMap(placeholders);
    const items = findTodos(input).filter((i) => !i.text.startsWith('Example post') && i.href !== null);
    const optional = items.filter((i) => i.text.startsWith('Optional'));
    expect(items.length - optional.length).toBe(marks.length);
  });

  it('links each item to the screen where it’s fixed', () => {
    for (const item of findTodos(repo())) {
      if (item.href !== null) expect(item.href).toMatch(/^#\/[a-z]+(\/[\w-]+)?$/);
    }
  });

  it('flags example posts still published, but not drafts', () => {
    const input = repo();
    input.posts = [
      { slug: 'a', data: { title: 'A', sample: true }, body: '' },
      { slug: 'b', data: { title: 'B', sample: true, draft: true }, body: '' },
      { slug: 'c', data: { title: 'C' }, body: '' },
    ];
    const samples = findTodos(input).filter((i) => i.text.startsWith('Example post'));
    expect(samples.map((s) => s.href)).toEqual(['#/post/a']);
  });

  it('asks for the enquiry key, badge and stats only while they’re empty', () => {
    const input = repo();
    const site = input.site as {
      enquiries: { accessKey: string };
      hero: { badge: { value: string } };
      about: { stats: { value: string; label: string }[] };
    };
    const extras = () => findTodos(input).filter((i) => i.href === null || i.text.startsWith('Optional'));
    site.enquiries.accessKey = '';
    site.hero.badge.value = '';
    site.about.stats = [];
    expect(extras()).toHaveLength(3);
    expect(extras().find((i) => i.href === null)?.where).toBe('Jack will set this up');
    site.enquiries.accessKey = 'key';
    site.hero.badge.value = '100 km';
    site.about.stats = [{ value: '12', label: 'Ultras' }];
    expect(extras()).toHaveLength(0);
  });

  it('is empty when nothing is left', () => {
    const input = repo();
    const site = input.site as Record<string, Record<string, unknown>>;
    site.enquiries.accessKey = 'key';
    site.hero.badge = { label: 'Longest run', value: '100 km' };
    site.about.stats = [{ value: '12', label: 'Ultras' }];
    input.faq = [{ question: 'Q', answer: 'A' }];
    input.posts = [];
    input.policies = [];
    expect(findTodos(input)).toEqual([]);
  });
});
