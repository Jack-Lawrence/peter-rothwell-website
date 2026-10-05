import type { APIRoute } from 'astro';
import { PREVIEW } from 'astro:env/server';
import { absolute } from '../lib/url';

// The preview build is kept out of search engines; the live site is open.
export const GET: APIRoute = () => {
  const body = PREVIEW
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${absolute('/sitemap-index.xml')}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
