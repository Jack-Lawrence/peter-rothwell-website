import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'journal'>;

/** Posts per page on the journal list; more than this and it paginates. */
export const PAGE_SIZE = 12;

// Published posts, newest first.
export async function getPosts() {
  const posts = await getCollection('journal', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** "4 min read", at 230 words a minute. */
export function readingTime(post: Post): string {
  const words = (post.body ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links keep their text
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`|-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 230))} min read`;
}

/** "Race report" → "race-report" */
export function topicSlug(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Each topic used by a published post, with its URL slug, in A–Z order. */
export function getTopics(posts: Post[]) {
  const topics = new Map<string, string>();
  for (const p of posts) topics.set(topicSlug(p.data.topic), p.data.topic);
  return [...topics].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Splits posts into pages of PAGE_SIZE. Page numbers start at 1. */
export function paginate(posts: Post[]) {
  const pages: Post[][] = [];
  for (let i = 0; i < posts.length; i += PAGE_SIZE) pages.push(posts.slice(i, i + PAGE_SIZE));
  return pages.length ? pages : [[]];
}
