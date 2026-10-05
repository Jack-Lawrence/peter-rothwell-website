// @ts-check
import { defineConfig, envField } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import figures from './src/lib/markdown-figures.mjs';

// SITE_URL and BASE_PATH are set by the GitHub Pages workflow, where the site
// lives under /<repo>/. On Cloudflare (or locally) the defaults apply.
const base = process.env.BASE_PATH || '/';
const to = (/** @type {string} */ path) => base.replace(/\/$/, '') + path;

export default defineConfig({
  site: process.env.SITE_URL || 'https://www.rothwellsrunning.com',
  base,
  // Inline the (small) CSS into each page so it doesn't block the first paint.
  build: {
    inlineStylesheets: 'always',
  },
  // Images in blog posts get a srcset, so phones don't download the full-size photo.
  image: {
    layout: 'constrained',
    responsiveStyles: false,
  },
  markdown: {
    // Blog images with a title get a caption.
    processor: satteri({ hastPlugins: [figures] }),
  },
  integrations: [
    sitemap({
      // Leave out the old Wix redirect pages and the admin area.
      filter: (page) => !/\/(english-[^/]+|accessibility-statement|admin)(\/|$)/.test(new URL(page).pathname),
    }),
  ],
  env: {
    schema: {
      // PREVIEW=true (set by the GitHub Pages workflow) hides the site from
      // search engines and shows a "not live yet" bar on every page.
      PREVIEW: envField.boolean({ context: 'server', access: 'public', default: false }),
      // The GitHub repo the admin area commits to (owner/name).
      ADMIN_REPO: envField.string({ context: 'server', access: 'public', default: 'Jack-Lawrence/peter-rothwell-website' }),
    },
  },
  // Old Wix addresses, so existing links and search results still work.
  redirects: {
    '/english-privacy-policy': to('/privacy/'),
    '/english-terms-conditions': to('/terms/'),
    '/english-refund-policy': to('/refunds/'),
    '/accessibility-statement': to('/accessibility/'),
  },
});
