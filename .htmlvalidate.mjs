// html-validate settings for the built site (dist/**/*.html).
export default {
  extends: ['html-validate:recommended'],
  rules: {
    // Headings like "## 1. Booking" get ids such as "1-booking". HTML5 allows ids
    // that start with a digit; the strict mode only matters for old CSS selectors.
    'valid-id': ['error', { relaxed: true }],
    // Astro writes the redirect pages for the old Wix addresses with a lowercase
    // doctype. Both cases are valid HTML; this rule is only about style.
    'doctype-style': 'off',
    // Long titles get cut off in search results, but a long blog post title from
    // the admin area shouldn't block a deploy, so this only warns.
    'long-title': ['warn', { maxlength: 70 }],
  },
};
