import type { APIRoute } from 'astro';
import { PREVIEW } from 'astro:env/server';

// The preview build is kept out of search engines; the live site is open.
export const GET: APIRoute = () => {
  const body = PREVIEW ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
