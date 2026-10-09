# Site audit: 9 October 2026

## Re-audit after round 2

Every prompt in [PROMPTS.md](PROMPTS.md) (round 2) has been done. Re-scored with the same areas and weights as the audit below.

### Overall score: 87 / 100 (was 80)

| Area               | Score | Weight | Was | What changed                                                                                                                                                                                           |
| ------------------ | ----- | ------ | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Performance        | 97    | 15%    | 90  | Home page 604 → 176 KiB on mobile, LCP 2.3 → 1.9 s; only the first carousel photo loads up front; no PNG fallbacks (deploy 73 → 51 MB); two font preloads instead of four; idle hourly deploys skipped |
| Accessibility      | 97    | 15%    | 90  | Carousel pause/play button, and it stops off screen and in background tabs; label-in-name fixed; target sizes checked at 375 and 1440 px; axe runs in CI on four pages                                 |
| SEO                | 95    | 15%    | 88  | Sitemap `lastmod` for posts, breadcrumbs and `dateModified` on posts, distinct titles for list pages, an SEO check in CI; Lighthouse SEO 100 on a normal build                                         |
| Content            | 60    | 20%    | 55  | Example posts clearly labelled on the preview, claims about Peter replaced with placeholders, stock photos gone. Still waiting on Peter: 17 placeholders, real posts, plan details, more reviews       |
| Features           | 90    | 15%    | 82  | The admin checks a save before committing, then shows "Updating…", "Live" or "didn't go live"; "Still to do" list; keep-me-signed-in option; hero badge editable. Form and Instagram still await keys  |
| Code quality       | 95    | 10%    | 88  | 113 unit tests (Vitest) and 27 end-to-end tests (Playwright) in CI; `admin/main.ts` split from 3,350 lines into 15 modules; content rules shared by the tests and the admin                            |
| Security & privacy | 88    | 10%    | 78  | Script escaping fixed and tested; CSP on `/admin`; token kept per tab unless Peter opts in. The shared `github.io` origin and missing security headers remain until Cloudflare                         |

Weighted total: 87.2, rounded to 87. Content is still the biggest gap, and only Peter can close it.

### Tests (9 October, after a clean `npm ci`, with `PREVIEW=true`)

| Check                                     | Result                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run format:check`                    | Pass                                                                                                                                 |
| `npm run check`                           | 0 errors, 0 warnings, 0 hints                                                                                                        |
| `npm test` (Vitest)                       | 113 tests in 12 files pass (about 20 s)                                                                                              |
| `npm run build`                           | Pass, 14 pages and 4 redirects                                                                                                       |
| `npm run validate:html`                   | Pass                                                                                                                                 |
| `npm run check:links`                     | 278 links, none broken                                                                                                               |
| `node scripts/check-seo.mjs`              | 13 public pages, none missing a title, description, canonical link or share image, no repeats                                        |
| `npm run test:e2e` (Playwright, Chromium) | 27 tests pass, including its own base-path build (about 50 s)                                                                        |
| Lighthouse CI, mobile, best of 3          | Home 98 / 100 / 100, Journal 99 / 100 / 100, Terms 100 / 100 / 100 (Perf / A11y / BP)                                                |
| Lighthouse SEO, normal build              | 100 on `/`, `/journal/` and a post                                                                                                   |
| `npm audit --omit=dev`                    | 0 vulnerabilities                                                                                                                    |
| Layout, base-path preview build           | First screen and "Ways to train" exactly one screen at 1920×929, 1440×900 and 1366×768, dark and light; no sideways scroll at 375 px |
| Admin, demo mode                          | Every screen opens without errors; "Still to do" (23 items), price edit, new post, photo crop, colours and reset all work            |

### Findings fixed

All 16 findings below are fixed: 1 (escaping), 2 (example posts labelled and placeholders added, though the real posts are still Peter's to write), 3 (carousel pause), 4 (save status), 5 (carousel images), 6 (PNG fallbacks), 7 (label in name), 8 (token storage and CSP), 9 (tests), 10 (hourly deploys), 11 (target size), 12 (font preloads), 13 (sign-in wording), 14 (`main.ts` split), 15 (sitemap and breadcrumbs), 16 (patch updates).

Also fixed along the way: the enquiry form's "Thanks, Sam" never appeared (a literal backspace character sat where the regex `\b` should be; a unit test now rejects control characters in source); on phones the header covered half of the preview bar; a bare email address in a post turned into a Markdown link when the post was saved; the post editor dropped `<mark>` highlights on save.

### Next

- **Hard-coded wording.** A few visitor-facing words are still in components rather than `site.json`: "← All posts" on posts, "Get directions" and "Inside" in the footer and on the map, the enquiry form's labels and messages, and the topic pages' "Posts about … from coach Peter Rothwell".
- **Failure notifications.** "Jack has the details" relies on Jack hearing about failed runs. GitHub notifies whoever triggered a run, which for the admin's saves is Peter, so set up notifications for Jack (or a workflow step that opens an issue or emails him when Checks fails on `main`).
- **Try the save status with Peter's real token.** It's unit-tested, and the Actions API works without a token for this public repo, but it hasn't been tried in a live save with a fine-grained token yet.
- **Dev dependencies.** `npm audit` including dev dependencies reports 19 issues, all inside `@lhci/cli`'s dependencies; production has none. Update when a fixed `@lhci/cli` is out.
- **Windows and Git Bash.** Git Bash turns `BASE_PATH=/peter-rothwell-website/` into a Windows path; use PowerShell or `MSYS_NO_PATHCONV=1` (noted in the README).
- **Launch.** The Cloudflare prompt at the end of this file and [LAUNCH.md](LAUNCH.md): security headers, the enquiry Worker, Instagram, and removing `PREVIEW`.

---

## Audit before round 2

Second pre-launch audit of the Astro rebuild of rothwellsrunning.com, at commit `8387012` (GitHub Pages preview, not live). The first audit (5 October, 72/100) is in git history. Every prompt from that round has been done.

## Overall score: 80 / 100

The engineering is in good shape: fast, accessible, valid HTML, no broken links, clean types, CI on every change, and a working admin area. Most of the remaining gap is content Peter still has to supply or confirm, which no code change can close. The rest is a handful of real bugs and polish items, listed below and covered by the prompts in [PROMPTS.md](PROMPTS.md).

| Area               | Score | Weight | Was | Notes                                                                                                                 |
| ------------------ | ----- | ------ | --- | --------------------------------------------------------------------------------------------------------------------- |
| Performance        | 90    | 15%    | 95  | Lighthouse 96–100 mobile, now with real photos; carousel photos oversized on phones; 25 MB of unused PNG fallbacks    |
| Accessibility      | 90    | 15%    | 92  | Lighthouse 100 and a WCAG 2.2 review done; auto-playing carousel has no pause button; label-in-name mismatches        |
| SEO                | 88    | 15%    | 62  | Sitemap, robots, share image, JSON-LD, 404, RSS and preview `noindex` all in place; small polish left                 |
| Content            | 55    | 20%    | 45  | Peter's own photos now in; sample posts are invented first-person copy with stock covers; 13 placeholders remain      |
| Features           | 82    | 15%    | 60  | Admin area, demo modes, journal features done; form and Instagram await keys; admin can't tell Peter a save failed    |
| Code quality       | 88    | 10%    | 82  | 0 type errors, Prettier, CI, HTML validation, Lighthouse CI; no unit or end-to-end tests; `admin/main.ts` 3,200 lines |
| Security & privacy | 78    | 10%    | 80  | No trackers, 0 npm vulnerabilities; a broken `</script>` escape; admin token in localStorage on a shared origin       |

Weighted total: 80.1, rounded to 80.

## What was tested

| Check                                             | Result                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `npm run format:check`                            | Pass                                                                                  |
| `npm run check` (TypeScript, 59 files)            | 0 errors, 0 warnings, 0 hints                                                         |
| `npm run build`                                   | Pass, 18 pages                                                                        |
| `npm run validate:html`                           | Pass                                                                                  |
| `npm run check:links`                             | 148 links, none broken                                                                |
| `npm audit --omit=dev`                            | 0 vulnerabilities                                                                     |
| Lighthouse CI, mobile, `PREVIEW=true` (best of 3) | Home 97 / 100 / 100, Journal 99 / 100 / 100, Terms 100 / 100 / 100 (Perf / A11y / BP) |
| Home page, mobile                                 | LCP 2.3 s, CLS 0.000, TBT 38 ms, 601 KiB                                              |
| Layout                                            | One-screen hero and "Ways to train" correct at 1366×768; no sideways scroll at 375 px |
| Browser console                                   | No errors on home, journal post or admin                                              |

## Findings

### High priority

1. **Broken `<` escaping in two inline scripts.** `src/components/JsonLd.astro` and `src/pages/admin/index.astro` both do `.replace(/</g, '<')`. In JavaScript source `'<'` _is_ `<`, so the replace does nothing. Any content containing `</script>` (a blog post, an FAQ answer, any `site.json` text, all of which are embedded in the admin page) closes the script tag early: the admin breaks, and in the worst case content becomes markup. Should be `'\\u003c'`.
2. **Sample posts read as real.** The three journal posts are invented first-person copy (one is a race report Peter didn't write), with stock cover photos from `src/assets/demo/`. The "Sample" label was removed in `6db368a`, so on the preview they look like Peter's own words. This breaks the project's "never invent facts about Peter" rule, and Peter may approve them without noticing.
3. **Auto-playing carousels have no pause control** (WCAG 2.2.2). The hero and Run Club photos change every 6 s. They pause on hover and focus, and not at all with reduced motion, but touch users can't stop them, and they keep running off screen and in background tabs.
4. **The admin can't tell Peter when a save didn't go live.** Every save commits to `main`, and the deploy only runs if Checks pass. If a save breaks the build, Peter still sees "your site will update in about a minute" and nothing changes.

### Medium priority

5. **Carousel photos are oversized on phones.** Slides only come in 540 and 1080 px widths, so a 379 px-wide slide on a typical phone downloads the 1080 version, and all four slides of each carousel load up front. Lighthouse estimates 300–430 KiB of savings on the home page.
6. **25 MB of PNG fallbacks.** `Photo.astro` uses `<Picture>` with WebP sources, so Astro's fallback `<img>` is PNG (18 files up to 3.3 MB each). Modern browsers never fetch them, but they bloat every deploy and are what old browsers and some crawlers get. Set `fallbackFormat="jpg"`.
7. **Label in Name** (WCAG 2.5.3, flagged by Lighthouse). The map link and the journal post cards have accessible names that don't contain their visible text.
8. **Admin token storage on GitHub Pages.** The token sits in `localStorage` on `jack-lawrence.github.io`, an origin shared by every Pages site on that account. Any script on any of those sites could read it. Fine on Cloudflare later; worth a "remember on this device" opt-in and a CSP on `/admin` now.
9. **No unit or end-to-end tests.** CI checks build, types, HTML, links and Lighthouse, but nothing checks behaviour: the Markdown round trip in the editor, contrast checks for colour themes, the mobile menu, the form's demo mode, or the admin's demo saves.
10. **Hourly deploys that do nothing.** `deploy.yml` rebuilds and redeploys every hour to fetch Instagram posts, but there's no token yet, so that's 24 identical deploys a day.

### Low priority

11. Footer legal links are 15 px tall (WCAG 2.2 target size wants 24 px or enough spacing).
12. Four fonts are preloaded on every page; only the two above the fold need it.
13. The admin sign-in screen says changes "go live on rothwellsrunning.com", which isn't true on the preview.
14. `src/admin/main.ts` is 3,221 lines in one file, which makes future changes slow and risky.
15. Sitemap has no `lastmod`; blog posts have no breadcrumb data. Minor SEO polish.
16. Patch updates available: `astro` 7.3.5 → 7.3.8, `marked`, `@astrojs/markdown-satteri`, `prettier-plugin-astro`.

### Content Peter still has to supply (not code)

- Answers for the 13 `<mark>` placeholders: 10 in the policies (`privacy.md` ×3, `refunds.md` ×2, `terms.md` ×5) and 3 in `faq.json`, which show on the home page.
- Confirmation of what's included in each plan (`services.json`), and prices.
- Real blog posts, or approval to launch with none.
- More testimonials (there are 2), optional hero badge and About stats.
- Web3Forms key, Instagram token and the domain: see [LAUNCH.md](LAUNCH.md).

### What's already good

- Fast and light: 95–180 KiB on inner pages, inline CSS, self-hosted fonts, almost no JavaScript on public pages (the 512 KB editor bundle only loads on `/admin`).
- Accessible: Lighthouse 100 everywhere, skip link, visible focus, reduced-motion support, a written accessibility statement.
- Preview protection works: `noindex`, disallow-all robots and a "not live yet" bar on GitHub Pages builds only.
- Every visitor-facing word is editable in the admin, with a demo mode Peter can try safely.
- CI blocks a broken build from deploying.
- No cookies, trackers or third-party requests.

---

## Going live: Cloudflare prompt

For after Peter has signed off and the domain is available (see [LAUNCH.md](LAUNCH.md) step 7). The pre-launch work is in [PROMPTS.md](PROMPTS.md).

```
Move this Astro 7 site (see README.md and LAUNCH.md) from GitHub Pages to Cloudflare Pages with the custom domain www.rothwellsrunning.com.
1. Cloudflare Pages build: npm run build, output dist, Node 24, no BASE_PATH. Keep the GitHub Pages workflow for preview branches only, or remove it.
2. Add public/_headers with security headers: Content-Security-Policy (self only, plus whatever the enquiry form needs), Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Add long-cache headers for /_astro/*.
3. Add public/_redirects for the old Wix URLs (replacing the meta-refresh redirect pages in astro.config.mjs) and apex → www.
4. Replace Web3Forms with a Cloudflare Pages Function at /api/enquiry. Verify a Turnstile token server-side, re-run the honeypot, time and link checks on the server, rate-limit by IP, and send the email to Peter using Cloudflare Email Routing's send_email binding (destination address verified). Update src/components/EnquiryForm.astro to use Turnstile and the new endpoint.
5. Instagram: replace the hourly GitHub Actions rebuild with a scheduled Worker that refreshes the token (stored in Workers KV) and triggers a Pages deploy hook only when the latest posts change.
6. Add Cloudflare Web Analytics (cookieless) and mention it in src/content/legal/privacy.md.
7. Remove PREVIEW from deploy.yml and checks.yml so live builds are indexable.
Write the setup steps into LAUNCH.md.
```
