// Prefix internal links with the base path, so the site works both at the
// domain root and under /<repo>/ on GitHub Pages.
const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export function href(path: string): string {
  return base + (path.startsWith('/') ? path : `/${path}`);
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, '').replace(/^0/, '+44')}`;
}
