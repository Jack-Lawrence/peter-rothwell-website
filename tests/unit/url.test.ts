import { afterEach, describe, expect, it, vi } from 'vitest';

// url.ts reads the base path when it loads, so each case loads a fresh copy.
async function load(base: string, site = 'https://www.rothwellsrunning.com') {
  vi.resetModules();
  vi.stubEnv('BASE_URL', base);
  vi.stubEnv('SITE', site);
  return import('../../src/lib/url');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('at the domain root', () => {
  it('builds links', async () => {
    const { href, absolute, baseLinks } = await load('/');
    expect(href('/terms/')).toBe('/terms/');
    expect(href('journal/')).toBe('/journal/');
    expect(href('/')).toBe('/');
    expect(absolute('/journal/')).toBe('https://www.rothwellsrunning.com/journal/');
    expect(baseLinks('<a href="/terms/">Terms</a>')).toBe('<a href="/terms/">Terms</a>');
  });
});

describe('under a base path (GitHub Pages)', () => {
  it('prefixes internal links', async () => {
    const { href, absolute, baseLinks } = await load('/peter-rothwell-website/', 'https://jack-lawrence.github.io');
    expect(href('/terms/')).toBe('/peter-rothwell-website/terms/');
    expect(href('journal/')).toBe('/peter-rothwell-website/journal/');
    expect(href('/')).toBe('/peter-rothwell-website/');
    expect(absolute('/journal/')).toBe('https://jack-lawrence.github.io/peter-rothwell-website/journal/');
    expect(baseLinks('<a href="/terms/">Terms</a>')).toBe('<a href="/peter-rothwell-website/terms/">Terms</a>');
  });

  it('leaves external and protocol-relative links alone', async () => {
    const { baseLinks } = await load('/peter-rothwell-website/');
    const html = '<a href="https://example.com/">x</a><a href="//cdn.example.com/">y</a><a href="#top">z</a>';
    expect(baseLinks(html)).toBe(html);
  });
});

describe('telHref', () => {
  it('turns a UK number into an international tel: link', async () => {
    const { telHref } = await load('/');
    expect(telHref('07367 636632')).toBe('tel:+447367636632');
  });
});
