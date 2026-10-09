// The content files in the repo must pass the rules the admin checks before saving,
// and those rules must agree with the build's own schemas (src/content.config.ts).
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'astro/zod';
import { DATA_FILES, checkDataFile, checkPolicy, checkPost } from '../../src/lib/content-rules';
import { parseDoc } from '../../src/admin/markdown';

vi.mock('astro:content', () => ({ defineCollection: (c: unknown) => c }));
const { collections } = await import('../../src/content.config');

type SchemaFn = (ctx: { image: () => z.ZodType }) => z.ZodType;
const postSchema = (collections.journal.schema as unknown as SchemaFn)({ image: () => z.string() });
const policySchema = collections.legal.schema as unknown as z.ZodType;

const read = (path: string) => readFileSync(path, 'utf8');

describe('data files', () => {
  const files = readdirSync('src/data').map((f) => `src/data/${f}`);

  it('every file in src/data has rules', () => {
    expect(files.sort()).toEqual(Object.keys(DATA_FILES).sort());
  });

  it.each(files)('%s parses and has every field the site reads', (file) => {
    expect(checkDataFile(file, read(file))).toEqual([]);
  });

  it('spots a broken file', () => {
    expect(checkDataFile('src/data/faq.json', '[{"question": "Hi"')).toEqual([
      'your questions: the file isn’t valid JSON',
    ]);
  });

  it('spots missing and wrong fields, and says where', () => {
    const site = JSON.parse(read('src/data/site.json'));
    site.hero.intro = '';
    site.hero.headline = 'Run further.';
    delete site.nav;
    expect(checkDataFile('src/data/site.json', JSON.stringify(site))).toEqual([
      'your website’s wording: nav: is missing',
      'your website’s wording: hero.headline: should be a list',
      'your website’s wording: hero.intro: is empty',
    ]);
  });

  it('allows the optional fields to be empty', () => {
    const site = JSON.parse(read('src/data/site.json'));
    site.hero.badge = { label: '', value: '' };
    site.about.stats = [];
    site.enquiries.accessKey = '';
    expect(checkDataFile('src/data/site.json', JSON.stringify(site))).toEqual([]);
  });

  it('needs at least one plan', () => {
    expect(checkDataFile('src/data/services.json', '[]')).toEqual([
      'your plans and prices: the file: needs at least 1',
    ]);
  });
});

describe('posts and policies', () => {
  const md = (dir: string) => readdirSync(dir).map((f) => `${dir}/${f}`);

  it.each(md('src/content/journal'))('%s passes', (file) => {
    expect(checkPost(parseDoc(read(file)).data)).toEqual([]);
  });

  it.each(md('src/content/legal'))('%s passes', (file) => {
    expect(checkPolicy(parseDoc(read(file)).data)).toEqual([]);
  });

  it('explains what a post is missing', () => {
    expect(checkPost({ date: '2026-10-09', topic: 'Strength', excerpt: 'x' })).toEqual(['The post needs a title.']);
    expect(checkPost({})).toEqual([
      'The post needs a title.',
      'The post needs a date.',
      'The post needs a topic.',
      'The post needs a short summary.',
    ]);
  });
});

describe('the admin’s rules match the build’s schemas', () => {
  const good = { title: 'A post', date: '2026-10-09', topic: 'Strength', excerpt: 'Summary' };
  const posts: Record<string, Record<string, unknown>> = {
    complete: { ...good, cover: '../../assets/journal/a.jpg', coverAlt: 'Peter', draft: true, sample: false },
    minimal: good,
    'no title': { ...good, title: undefined },
    'bad date': { ...good, date: 'soon' },
    'no topic': { ...good, topic: undefined },
    'no excerpt': { ...good, excerpt: undefined },
    'draft as text': { ...good, draft: 'yes' },
    'sample as text': { ...good, sample: 'yes' },
    'number title': { ...good, title: 5 },
  };

  it.each(Object.entries(posts))('post: %s', (_, front) => {
    expect(checkPost(front).length === 0).toBe(postSchema.safeParse(front).success);
  });

  const policy = { title: 'Terms', description: 'The terms.', updated: '2026-10-01', order: 2 };
  const policies: Record<string, Record<string, unknown>> = {
    complete: policy,
    'no title': { ...policy, title: undefined },
    'no description': { ...policy, description: undefined },
    'bad date': { ...policy, updated: 'never' },
    'order as text': { ...policy, order: 'two' },
    'no order': { ...policy, order: undefined },
  };

  it.each(Object.entries(policies))('policy: %s', (_, front) => {
    expect(checkPolicy(front).length === 0).toBe(policySchema.safeParse(front).success);
  });
});
