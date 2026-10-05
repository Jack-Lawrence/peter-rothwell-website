// Prefix internal links with the base path, so the site works both at the
// domain root and under /<repo>/ on GitHub Pages.
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function href(path: string): string {
  return base + (path.startsWith('/') ? path : `/${path}`);
}

// Full URL including the domain, for share tags, sitemaps and structured data.
export function absolute(path: string): string {
  return new URL(href(path), import.meta.env.SITE).href;
}

// Adds the base path to site-relative links (href="/terms/") in rendered Markdown.
export function baseLinks(html: string): string {
  return html.replace(/href="\/(?!\/)/g, `href="${base}/`);
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, '').replace(/^0/, '+44')}`;
}
