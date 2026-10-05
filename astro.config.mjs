// @ts-check
import { defineConfig } from 'astro/config';

// SITE_URL and BASE_PATH are set by the GitHub Pages workflow, where the site
// lives under /<repo>/. On Cloudflare (or locally) the defaults apply.
const base = process.env.BASE_PATH || '/';
const to = (/** @type {string} */ path) => base.replace(/\/$/, '') + path;

export default defineConfig({
  site: process.env.SITE_URL || 'https://www.rothwellsrunning.com',
  base,
  // Old Wix addresses, so existing links and search results still work.
  redirects: {
    '/english-privacy-policy': to('/privacy/'),
    '/english-terms-conditions': to('/terms/'),
    '/english-refund-policy': to('/refunds/'),
    '/accessibility-statement': to('/accessibility/'),
  },
});
