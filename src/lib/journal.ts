import { getCollection } from 'astro:content';

// Published posts, newest first.
export async function getPosts() {
  const posts = await getCollection('journal', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}
