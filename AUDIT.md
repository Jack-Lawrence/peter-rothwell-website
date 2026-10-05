# Site audit: 5 October 2026

Pre-launch audit of the Astro rebuild of rothwellsrunning.com, in its current state (not yet deployed).

## Overall score: 72 / 100

The build itself is fast, accessible and cleanly structured. The score is held back by things a visitor would notice straight away (no photos, sample blog posts, placeholder text in the policies) and by features that are built but not connected yet (enquiry form, Instagram feed), plus missing SEO groundwork.

| Area               | Score | Weight | Notes                                                                                            |
| ------------------ | ----- | ------ | ------------------------------------------------------------------------------------------------ |
| Performance        | 95    | 15%    | Lighthouse 100 (mobile and desktop), but measured without real photos                            |
| Accessibility      | 92    | 15%    | Lighthouse 100; manual checks good; no screen reader test yet                                    |
| SEO                | 62    | 15%    | No sitemap, robots.txt, share image, structured data or 404 page; the preview would be indexable |
| Content            | 45    | 20%    | No photos; three sample posts; 11 placeholders in policies; plan details unconfirmed             |
| Features           | 60    | 15%    | Form and Instagram built but not connected; admin area not built                                 |
| Code quality       | 82    | 10%    | Clear components, content in data files; no type checking or CI checks; nothing committed        |
| Security & privacy | 80    | 10%    | No trackers or cookies, layered spam traps; no security headers until Cloudflare                 |

Weighted total: 71.6, rounded to 72.

## What was tested

- **Lighthouse 12** on the production build (home page mobile and desktop, terms page mobile): Performance, Accessibility, Best Practices and SEO all **100**.
  - Mobile: First Contentful Paint 1.5 s, Largest Contentful Paint 1.5 s, Total Blocking Time 0 ms, Cumulative Layout Shift 0.014, total page weight 91 KiB.
  - Only flag: render-blocking CSS, about 700 ms potential saving on throttled mobile.
- **Internal links** across all 9 pages: none broken.
- **Headings:** exactly one `<h1>` per page.
- **Enquiry form:** bot-style submit, honeypot, link filter and validation all behave as designed (tested with sending intercepted).
- **Layout:** first screen and "Ways to train" section each fit one screen at 1920×929, 1440×900 and 1366×768; no sideways scrolling at 375 px.

## Findings

### High priority (before launch)

1. **No photos.** The hero, About portrait, blog covers and Instagram grid are all placeholders. This is the biggest gap between the site and "eye-catching". Lighthouse scores will drop once photos are added unless they're handled carefully (see 4).
2. **Preview will be indexed by Google.** Builds on GitHub Pages have no `noindex`, and the canonical URL points at the github.io address. Search engines could index the preview and treat it as the real site.
3. **No sitemap, robots.txt, share image or structured data.** Links shared on WhatsApp, Facebook or Instagram show no image. There's no `LocalBusiness` data to support "personal trainer Edinburgh" searches.
4. **Every photo is lazy-loaded.** `Photo.astro` uses lazy loading for all images, including the hero. Once a real hero photo is added it will load late and hurt Largest Contentful Paint. Instagram images use a plain `<img>` with no width or height, so they will shift the layout as they load.
5. **Placeholder content is visible.** Three sample posts (labelled "Sample"), 11 highlighted gaps across the four policies, and "what's included" lines on each plan that Peter hasn't confirmed.
6. **Form and Instagram not connected.** Both need keys (see [LAUNCH.md](LAUNCH.md)).

### Medium priority

7. **Render-blocking CSS** (about 700 ms on slow mobile). Inlining the stylesheets would remove it, since they're small.
8. **No 404 page.** GitHub Pages and Cloudflare will show their own generic page.
9. **No app icon or web manifest.** "Add to Home Screen" on iPhone uses a screenshot instead of the logo.
10. **No automated checks.** There's no `astro check` (TypeScript), link checker or Lighthouse run in CI, so regressions would go unnoticed.
11. **No security headers.** GitHub Pages can't set them. On Cloudflare, add a Content Security Policy, HSTS and the usual headers through `_headers`.
12. **Spam checks are mostly client-side.** A bot posting directly to Web3Forms only meets Web3Forms' own filter. Moving to a Cloudflare Worker with Turnstile fixes this.
13. **Nothing is committed.** The project is a git repo with no commits and no GitHub remote.

### Low priority

14. No privacy-friendly analytics, so there's no way to know if the site is bringing in enquiries. Cloudflare Web Analytics is free and cookieless.
15. The journal has no RSS feed, topic filter, reading time or previous/next links.
16. Only two testimonials. The carousel is ready for more.
17. The dev server on Windows sometimes serves stale component styles until restarted. This affects development only, not the live site.

### What's already good

- Fast: 91 KiB page weight, self-hosted fonts, almost no JavaScript.
- Accessible: skip link, visible focus, labelled form, reduced-motion support, good contrast, works with keyboard.
- Private by default: no cookies, trackers or third-party requests, so no cookie banner is needed.
- Content lives in plain data files, ready for the admin area.
- Old Wix policy URLs redirect to the new pages.
- The policies are real and specific to Peter's business. The Wix versions were unfinished templates.

---

## AI handoff prompts

**For work before launch, use [PROMPTS.md](PROMPTS.md)**, which has updated prompts that need no accounts or keys. The prompts below are the original set; prompt 5 (Cloudflare) is still the one to use when going live.

Each prompt stands alone: paste it into a new Claude Code session opened in this project folder.

### 1. SEO foundations and preview protection

```
This is an Astro 7 static site for Rothwells Running, a personal trainer in Edinburgh (see README.md). It deploys to GitHub Pages for client preview (.github/workflows/deploy.yml sets SITE_URL and BASE_PATH) and will later move to Cloudflare Pages at https://www.rothwellsrunning.com.

Add SEO foundations:
1. Preview protection: add a PREVIEW env var (set to "true" in deploy.yml). When set, add <meta name="robots" content="noindex, nofollow"> to every page in src/layouts/Base.astro and output a robots.txt that disallows everything. When not set, robots.txt allows everything and points to the sitemap.
2. Add @astrojs/sitemap. Exclude the old Wix redirect pages (/english-*, /accessibility-statement).
3. Add Open Graph and Twitter card tags in Base.astro: og:image (default share image at public/og-default.png, 1200×630, built from the brand: dark green #1b211e, gorse yellow #e3b23c, "ROTHWELLS RUNNING" in Big Shoulders Display), og:url, og:site_name, twitter:card=summary_large_image. Blog posts use their cover as og:image when they have one.
4. Add JSON-LD: on the home page a LocalBusiness (or HealthAndBeautyBusiness) plus Person for Peter Rothwell, using src/data/site.json for the name, phone, email, address (1 Moray Park, Meadowbank, Edinburgh EH7 5TS), Instagram URL and the three services with prices from src/data/services.json. On blog posts, a BlogPosting with headline, datePublished and author.
5. Add a branded 404 page (src/pages/404.astro) using Base.astro, with links to the home page, coaching plans and contact.
6. Add apple-touch-icon (180×180 PNG) and a web manifest using the favicon mountain logo.

Respect the base path (use href() from src/lib/url.ts). Run npm run build and check the output for each item. Don't change the visual design.
```

### 2. Image performance (do before adding photos)

```
In this Astro 7 site (see README.md), prepare image handling so real photos don't hurt performance.

1. src/components/Photo.astro: add a `priority` prop. When true, use loading="eager", fetchpriority="high" and decoding="sync"; otherwise keep lazy loading. Use it for the hero photo in src/components/Hero.astro.
2. Make sure every <Image> outputs width/height (no layout shift), uses modern formats (avif/webp), and has sensible `sizes` for its layout: hero about 40vw on desktop and 100vw on mobile; About portrait about 45vw; blog cards about 33vw.
3. Instagram images (src/components/InstagramFeed.astro) are downloaded by scripts/fetch-instagram.mjs into public/instagram/ and shown with a plain <img>. Change the script to save them into src/assets/instagram/ (gitignored) and render them through astro:assets so they're resized to about 400px squares and given width/height. Keep a placeholder fallback when there are no posts.
4. Set build.inlineStylesheets to 'always' in astro.config.mjs (the CSS is small) and preload the latin Big Shoulders Display 900 font used in the hero headline.
5. Add a few test images to check, then run Lighthouse on mobile against `npm run build && npx astro preview`. Target: Performance ≥ 95, CLS < 0.05. Remove the test images afterwards.
```

### 3. Add real photos and content

```
Peter Rothwell has supplied photos in [FOLDER]. In this Astro site (see README.md):
1. Put them in src/assets/photos/ with descriptive file names. Resize anything over 2400px on its long edge.
2. Wire them into the hero (Hero.astro), About portrait (About.astro) and blog covers (frontmatter `cover` in src/content/journal/*.md), replacing the placeholders in Photo.astro calls. Write specific alt text for each (who, doing what, where).
3. Choose crops that keep faces in frame at desktop and phone widths (object-position).
4. Remove the three sample posts (`sample: true`) if Peter has written real ones, and the `sample` field from the schema in src/content.config.ts if none are left.
5. Update src/data/site.json about.stats and hero.badge with the numbers Peter supplied: [NUMBERS].
Run the build and check the home page at 1440×900 and 375 px wide.
```

### 4. Build the admin area

```
Build the admin area for this Astro 7 static site (see README.md). It's for Peter, a personal trainer who is not confident with websites. Design mockups are on the "Admin — Dashboard" and "Admin — Write a post" artboards at https://claude.ai/artifact/3Ny5cGNSJTWcKYYAeVur8z (read them with the Artifact tool).

Constraints: the site is static (GitHub Pages now, Cloudflare Pages later), with no server or database. All content is files in the repo:
- src/data/site.json (hero, about, contact, location, enquiries)
- src/data/services.json (plans and prices)
- src/data/testimonials.json
- src/data/week.json
- src/content/journal/*.md (blog posts; schema in src/content.config.ts)
- src/content/legal/*.md (policies)

Build /admin as a client-side app that reads and writes those files through the GitHub REST API (contents endpoint), committing each change to main, which triggers the existing deploy workflow. Requirements:
1. Sign in with GitHub. Peter has a GitHub account added as a collaborator. Use the GitHub OAuth device flow, or a fine-grained token he pastes once, kept in localStorage. Document the trade-off and pick the simplest secure option.
2. Dashboard as in the mockup: "Write a blog post", "Change prices", "Set Run Club dates", "Add a testimonial", recent posts with Draft/Live status, and Instagram status (read src/data/instagram.json).
3. Post editor: title, cover photo upload (commit the image to src/assets/journal/, resized in the browser to max 2000px), a simple rich text editor that saves Markdown (headings, bold, italic, lists, links, images), topic, draft/publish, and preview.
4. Forms for prices/services, testimonials, the week strip, contact details and policies. Validate before committing, and show friendly errors.
5. After each save, show "Saved. Your site will update in about a minute" and the commit link.
6. Big buttons, plain English, works well on a phone. Use the site's fonts and colours.
7. Exclude /admin from the sitemap and add noindex.
Write a short guide for Peter in docs/admin-guide.md.
```

### 5. Move to Cloudflare

```
Move this Astro 7 site (see README.md and LAUNCH.md) from GitHub Pages to Cloudflare Pages with the custom domain www.rothwellsrunning.com.
1. Cloudflare Pages build: npm run build, output dist, Node 24, no BASE_PATH. Keep the GitHub Pages workflow for preview branches only, or remove it.
2. Add public/_headers with security headers: Content-Security-Policy (self only, plus whatever the enquiry form needs), Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Add long-cache headers for /_astro/*.
3. Add public/_redirects for the old Wix URLs (replacing the meta-refresh redirect pages in astro.config.mjs) and apex → www.
4. Replace Web3Forms with a Cloudflare Pages Function at /api/enquiry. Verify a Turnstile token server-side, re-run the honeypot, time and link checks on the server, rate-limit by IP, and send the email to Peter using Cloudflare Email Routing's send_email binding (destination address verified). Update src/components/EnquiryForm.astro to use Turnstile and the new endpoint.
5. Instagram: replace the hourly GitHub Actions rebuild with a scheduled Worker that refreshes the token (stored in Workers KV) and triggers a Pages deploy hook only when the latest posts change.
6. Add Cloudflare Web Analytics (cookieless) and mention it in src/content/legal/privacy.md.
Write the setup steps into LAUNCH.md.
```

### 6. Quality gates

```
Add automated checks to this Astro 7 project (see README.md):
1. Install @astrojs/check and typescript; add "check": "astro check" to package.json. Fix any type errors it finds.
2. Add a GitHub Actions workflow (.github/workflows/checks.yml) that runs on pull requests and on pushes to main: npm ci, npm run check, npm run build, an internal link check on dist/ (e.g. lychee or linkinator, offline), and html-validate on dist/**/*.html.
3. Add Lighthouse CI (@lhci/cli) against `astro preview` for /, /journal/ and /terms/, with budgets: performance ≥ 90, accessibility 100, best practices ≥ 95, SEO 100 (SEO assertions off when PREVIEW=true, since preview pages are noindex).
4. Add Prettier with prettier-plugin-astro, matching the current style (2 spaces, single quotes, 120 columns), and a format check in CI.
Keep the checks fast (under 3 minutes).
```

### 7. Accessibility review

```
Do a manual accessibility review of this Astro site (see README.md) against WCAG 2.2 AA, beyond what Lighthouse checks:
1. Keyboard only: tab through every page, including the mobile menu (<details> in Header.astro), the testimonials carousel arrows (Testimonials.astro) and the enquiry form (EnquiryForm.astro). Check focus order, visible focus and that nothing traps focus.
2. Screen reader semantics: check the accessibility tree for the hero headline, the week strip (an <ol>), the price cards, the carousel (should it be announced as a carousel? are off-screen slides reachable?), the form's success and error messages (role=status), and the map link.
3. Check 200% and 400% zoom (reflow), text spacing overrides, and prefers-reduced-motion.
4. Check contrast for every text and background pair in src/styles/global.css, including placeholder text and yellow-on-dark.
Fix what you find, then update the "How this was checked" section of src/content/legal/accessibility.md with what was tested, and remove its placeholder.
```

### 8. Journal improvements

```
Improve the blog ("Training journal") in this Astro 7 site (see README.md; posts in src/content/journal/, pages in src/pages/journal/):
1. RSS feed with @astrojs/rss at /journal/rss.xml, linked in Base.astro's <head>.
2. Reading time on cards and posts (words ÷ 230, rounded).
3. Topic filter on /journal/ (static pages at /journal/topic/[topic]/, not client-side JS).
4. Previous/next post links and a "Train with Peter" call to action at the end of each post linking to /#coaching and /#contact.
5. Pagination once there are more than 12 posts.
Match the existing design (light chalk background, Big Shoulders Display headings, mono labels).
```
