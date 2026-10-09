// Checks the built site (run after `npm run build`): every public page needs a
// <title>, a meta description, a canonical link and a share image, and no two
// pages may share a title or a description. Usage: node scripts/check-seo.mjs [dist]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const dist = process.argv[2] ?? 'dist';

function pages(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return name.endsWith('.html') ? [path] : [];
  });
}

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
const meta = (html, attr, value) => {
  const tag = html.match(new RegExp(`<meta[^>]*${attr}="${value}"[^>]*>`, 'i'))?.[0];
  return tag && decode(tag.match(/content="([^"]*)"/i)?.[1] ?? '');
};

const problems = [];
const seen = { title: new Map(), description: new Map() };
let checked = 0;

for (const file of pages(dist)) {
  const url =
    '/' +
    relative(dist, file)
      .split(sep)
      .join('/')
      .replace(/index\.html$/, '');
  const html = readFileSync(file, 'utf8');
  // Not public pages: the admin area and the old Wix addresses (redirects).
  if (url.startsWith('/admin/') || /<meta[^>]*http-equiv="refresh"/i.test(html)) continue;
  checked++;

  const title = decode(html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '');
  const description = meta(html, 'name', 'description');
  const canonical = /<link[^>]*rel="canonical"[^>]*href="[^"]+"/i.test(html);
  const image = meta(html, 'property', 'og:image');

  if (!title) problems.push(`${url}: no <title>`);
  if (!description) problems.push(`${url}: no meta description`);
  if (!canonical) problems.push(`${url}: no canonical link`);
  if (!image) problems.push(`${url}: no og:image`);
  // The 404 page isn't indexed, so it may share wording with other pages.
  if (url === '/404.html') continue;
  for (const [kind, value] of [
    ['title', title],
    ['description', description],
  ]) {
    if (!value) continue;
    const other = seen[kind].get(value);
    if (other) problems.push(`${url}: same ${kind} as ${other} ("${value}")`);
    else seen[kind].set(value, url);
  }
}

if (checked === 0) {
  console.error(`No pages found in ${dist}/. Run npm run build first.`);
  process.exit(1);
}
if (problems.length) {
  console.error(`SEO check: ${problems.length} problem(s) in ${checked} pages:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(
  `SEO check: ${checked} pages, all have a title, description, canonical link and share image, none repeated.`,
);
