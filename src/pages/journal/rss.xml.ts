import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import site from '../../data/site.json';
import { getPosts } from '../../lib/journal';
import { absolute } from '../../lib/url';

// The training journal as an RSS feed, for feed readers and newsletters.
export const GET: APIRoute = async () => {
  const posts = await getPosts();
  return rss({
    title: `${site.name}: training journal`,
    description: 'Training tips, race reports and Run Club news from coach Peter Rothwell.',
    site: absolute('/'),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.excerpt,
      pubDate: post.data.date,
      link: absolute(`/journal/${post.id}/`),
      categories: [post.data.topic],
    })),
    customData: '<language>en-gb</language>',
  });
};
