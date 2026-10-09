import { describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({ getCollection: vi.fn() }));
const { PAGE_SIZE, getTopics, paginate, readingTime, topicSlug } = await import('../../src/lib/journal');
type Post = Parameters<typeof readingTime>[0];

const post = (topic: string, body = '', id = topic) => ({ id, body, data: { topic } }) as unknown as Post;

describe('readingTime', () => {
  it('is at least a minute', () => {
    expect(readingTime(post('A'))).toBe('1 min read');
  });

  it('counts words at 230 a minute, ignoring images, link targets and markup', () => {
    const words = Array.from({ length: 460 }, () => 'stride').join(' ');
    expect(readingTime(post('A', words))).toBe('2 min read');
    expect(readingTime(post('A', `${words} word`))).toBe('3 min read');
    const extra =
      '![a photo with many words in its alt text](../x.jpg) [link](https://example.com/very/long) <mark>x</mark>';
    expect(readingTime(post('A', `${words} ${extra}`))).toBe('3 min read');
  });
});

describe('topics', () => {
  it('makes URL slugs', () => {
    expect(topicSlug('Race report')).toBe('race-report');
    expect(topicSlug('Strength & conditioning')).toBe('strength-and-conditioning');
    expect(topicSlug('  Trail / Ultra! ')).toBe('trail-ultra');
  });

  it('lists each topic once, A–Z', () => {
    const posts = [post('Strength', '', '1'), post('Fuelling', '', '2'), post('Strength', '', '3')];
    expect(getTopics(posts)).toEqual([
      { slug: 'fuelling', name: 'Fuelling' },
      { slug: 'strength', name: 'Strength' },
    ]);
  });
});

describe('paginate', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => post('A', '', String(i)));

  it('always has a first page, even with no posts', () => {
    expect(paginate([])).toEqual([[]]);
  });

  it('splits into pages of PAGE_SIZE', () => {
    expect(paginate(many(PAGE_SIZE))).toHaveLength(1);
    const pages = paginate(many(PAGE_SIZE * 2 + 1));
    expect(pages.map((p) => p.length)).toEqual([PAGE_SIZE, PAGE_SIZE, 1]);
  });
});
