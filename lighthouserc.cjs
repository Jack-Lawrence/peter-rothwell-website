// Lighthouse CI: mobile checks of a few key pages against `astro preview`.
// Run with `npm run lhci` after `npm run build`.
const preview = process.env.PREVIEW === 'true';
const port = 4329;
const pages = ['/', '/journal/', '/terms/'];

module.exports = {
  ci: {
    collect: {
      // --ignore-lock: it can run alongside another astro preview (e.g. the end-to-end tests).
      startServerCommand: `npx astro preview --port ${port} --ignore-lock`,
      startServerReadyPattern: `localhost:${port}`,
      url: pages.map((p) => `http://localhost:${port}${p}`),
      // Shared CI machines are noisy, so each page is tested three times and the
      // best run counts (Lighthouse CI's default "optimistic" aggregation).
      numberOfRuns: 3,
      settings: {
        // Mobile is Lighthouse's default. Preview builds are noindex on purpose,
        // so the SEO category is skipped for them.
        onlyCategories: ['performance', 'accessibility', 'best-practices', ...(preview ? [] : ['seo'])],
        chromeFlags: '--no-sandbox',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 1 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        ...(preview ? {} : { 'categories:seo': ['error', { minScore: 0.9 }] }),
      },
    },
    upload: {
      // Reports are kept as files (uploaded as a workflow artifact), not sent to a public server.
      target: 'filesystem',
      outputDir: 'lighthouse-reports',
    },
  },
};
