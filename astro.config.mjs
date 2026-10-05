// @ts-check
import { defineConfig, envField } from 'astro/config';

// SITE_URL and BASE_PATH are set by the GitHub Pages workflow, where the site
// lives under /<repo>/. On Cloudflare (or locally) the defaults apply.
const base = process.env.BASE_PATH || '/';
const to = (/** @type {string} */ path) => base.replace(/\/$/, '') + path;

export default defineConfig({
  site: process.env.SITE_URL || 'https://www.rothwellsrunning.com',
  base,
  env: {
    schema: {
      // PREVIEW=true (set by the GitHub Pages workflow) hides the site from
      // search engines and shows a "not live yet" bar on every page.
      PREVIEW: envField.boolean({ context: 'server', access: 'public', default: false }),
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
