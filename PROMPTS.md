# Pre-launch handoff prompts (round 2)

Fixes and improvements from the [9 October audit](AUDIT.md) (80/100). Everything here works on the GitHub Pages preview and needs no accounts, keys or paid services.

## How to run them

These are written for **one long Claude Code session**, opened in this folder, with the prompts pasted **in order, one after another**. Project rules load automatically from `AGENTS.md`, so the prompts don't repeat them.

- Steps 1–7 change code but **don't commit**. Each ends with a quick check (types and build) so the next step starts from a working state.
- Step 8 is the only full test run. When it passes, it commits and pushes to `main`, which updates the GitHub Pages preview.
- If a step fails its own check, fix it before pasting the next one.
- If the session gets long and compacts, carry on: each prompt names the files it needs.

| #   | Step                           | Audit findings                | Size   |
| --- | ------------------------------ | ----------------------------- | ------ |
| 0   | Session rules                  | –                             | –      |
| 1   | Bug and security fixes         | 1, 6, 8, 13                   | Small  |
| 2   | Accessibility fixes            | 3, 7, 11                      | Small  |
| 3   | Performance                    | 5, 10, 12, 16                 | Medium |
| 4   | Honest preview content         | 2, plus a checklist for Peter | Medium |
| 5   | Automated tests                | 9                             | Large  |
| 6   | Admin: save status and tidy-up | 4, 14                         | Large  |
| 7   | SEO polish                     | 15                            | Small  |
| 8   | Full test, commit and deploy   | –                             | Medium |

Still for after launch: the Cloudflare prompt at the end of [AUDIT.md](AUDIT.md), and [LAUNCH.md](LAUNCH.md).

---

## 0. Session rules

```
This session works through a series of prompts I'll paste one at a time, based on AUDIT.md (9 October 2026). Read AGENTS.md, AUDIT.md and README.md now, then wait for step 1.

Rules for the whole session:
- Don't commit or push until step 8 tells you to.
- Don't change the visual design except where a step asks. Keep the design and content rules in AGENTS.md (square corners, colour tokens only, base-path-safe links via href(), no invented facts about Peter, every visitor-facing word in site.json and editable in the admin).
- End every step with `npm run check` and `npm run build`, both passing, and a short summary: what changed, which files, anything you decided not to do and why. Use the browser preview (launch config "site") only where the step asks.
- Keep a running list of anything you notice that's out of scope; I'll want it in step 8.
```

## 1. Bug and security fixes

```
Step 1: bug and security fixes (AUDIT.md findings 1, 6, 8, 13).

1. Script escaping. src/components/JsonLd.astro and src/pages/admin/index.astro both do `.replace(/</g, '<')`, which is a no-op because '<' in JS source is "<". Make both produce the six characters < (i.e. '\\u003c'). Put the escaping in one small shared helper (e.g. in src/lib/) and use it in both places. Prove it: temporarily add `</script><b>x</b>` to an FAQ answer and a site.json string, build, and confirm the JSON-LD and #admin-config scripts still parse (JSON.parse on their text) and the admin still loads in demo mode. Then remove the test text.
2. PNG fallbacks. In src/components/Photo.astro, pass fallbackFormat="jpg" to <Picture> so WebP sources don't fall back to multi-megabyte PNGs. Rebuild and confirm dist/_astro has no photo PNGs left (the icons and og-default.png in public/ are fine). Report dist size before and after.
3. Admin token storage. On GitHub Pages the admin runs on jack-lawrence.github.io, an origin shared by every Pages site on that account, so a token in localStorage is readable by them all. In src/admin/ (store.ts and the sign-in screen in main.ts):
   - add a "Keep me signed in on this device" checkbox, unticked by default; unticked stores the token in sessionStorage, ticked in localStorage. Existing localStorage tokens keep working. Sign out clears both.
   - add a Content-Security-Policy <meta> to src/pages/admin/index.astro only: default-src 'self'; connect-src 'self' https://api.github.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' plus whatever Astro's inline scripts need (prefer hashes over 'unsafe-inline'; check the built page). Check that demo mode, sign-in, image cropping and the editor all still work with it, with no CSP errors in the console.
   - add two sentences about this to README.md's admin section.
4. The admin sign-in screen says changes "go live on rothwellsrunning.com". Use the configured siteUrl (already in the admin config) so it names the right address on the preview.
```

## 2. Accessibility fixes

```
Step 2: accessibility fixes (AUDIT.md findings 3, 7, 11).

1. Carousels (src/components/Carousel.astro, used by Hero.astro and RunClub.astro) auto-advance every 6 s with no way for touch users to stop them (WCAG 2.2.2).
   - Add a pause/play button next to the existing "next" arrow, in the same style (square, mono, same size). It needs an accessible name that changes ("Pause photos" / "Play photos") and aria-pressed or equivalent. Once paused by the button it stays paused until played again, regardless of hover/focus.
   - Stop advancing while the carousel is off screen (IntersectionObserver) and while the tab is hidden (visibilitychange).
   - With prefers-reduced-motion, keep today's behaviour (never auto-advances) and hide the pause button, since there's nothing to pause.
   - Button labels come from site.json with fields in the admin, per AGENTS.md.
2. Label in Name (WCAG 2.5.3, flagged by Lighthouse): the map link in src/components/LocationMap.astro / ContactFooter.astro and the post cards in src/components/PostCard.astro have accessible names that don't contain their visible text. Fix so the name starts with the visible text. Re-run Lighthouse on / and confirm label-content-name-mismatch passes.
3. Target size: the footer's legal links are 15 px tall. Make every link and button on the public site at least 24×24 px or spaced per WCAG 2.5.8. Write a quick script in the browser console to list any remaining offenders at 375 px and 1440 px.
4. Check the hero still fits the first screen at 1920×929, 1440×900 and 1366×768, and nothing scrolls sideways at 375 px.
```

## 3. Performance

```
Step 3: performance (AUDIT.md findings 5, 10, 12, 16).

Measure first: npm run build, then `PREVIEW=true npm run lhci` (stop any other astro preview first). Note the home page's performance score, LCP and total bytes. Target afterwards: home page under 400 KiB on mobile, performance ≥ 97, no regressions on /journal/ or /terms/.

1. Carousel images: slides are only generated at 540 and 1080 px wide, so phones download the 1080 version for a ~380 px slide. Pick widths that cover the `sizes` in Hero.astro and RunClub.astro at 1x–3x (e.g. 400, 640, 800, 1080). Then only load the first slide up front: the other slides should load lazily just before they're shown (e.g. start them with loading="lazy" and switch to eager when the carousel first advances, or load slide n+1 when slide n shows). The first hero slide stays priority.
2. Font preloads: Base.astro preloads four fonts on every page. Keep preloads only for the fonts used on the first screen of most pages (check which weights the hero and header actually use); drop the rest. Confirm no visible font swap on the hero with font-display as it is.
3. Hourly deploy: .github/workflows/deploy.yml rebuilds every hour for Instagram, but there's no token yet. Make the scheduled run skip the build and deploy when the IG_ACCESS_TOKEN secret is empty (secrets can't be used in job-level `if`, so set an output in a first step and gate on it). Pushes and manual runs still always deploy. Add a comment explaining it.
4. Update the patch versions: astro, @astrojs/markdown-satteri, marked, prettier-plugin-astro (stay within current majors). Run the build and check nothing changed visually on the home page and a blog post.

Re-measure with lhci and report before/after numbers.
```

## 4. Honest preview content

```
Step 4: make the preview honest about what's placeholder, and give Peter a list of what he needs to supply (AUDIT.md finding 2 and "Content Peter still has to supply").

1. Sample posts. The three posts in src/content/journal/ are invented first-person copy (one is a race report Peter didn't write) and use stock covers from src/assets/demo/. The "Sample" label was removed in commit 6db368a. Bring back a clear label, preview builds only (PREVIEW), on the post card and at the top of the post page: something like "Example post: Peter will replace this". Use the existing `sample` frontmatter field. Wording goes in site.json with an admin field. The admin's post list should show the same flag, and saving a post from the admin clears `sample`.
2. In those three posts, replace any specific claim about Peter (races he ran, times, distances, personal anecdotes) with a <mark>[Peter to confirm: …]</mark> placeholder, per AGENTS.md. General training advice can stay.
3. Covers: swap the stock covers for suitable photos of Peter from src/assets/library/ (write specific alt text). If nothing in src/assets/demo/ is still used afterwards, delete the folder and its CREDITS.md, and remove the now-dead "Demo photo" logic (src/lib/demo.ts, the `demo` prop in Photo.astro) if nothing else uses it.
4. "Still to do" checklist for Peter in the admin dashboard (src/admin/main.ts, home screen): scan the content the admin already loads for
   - every <mark>…</mark> placeholder (policies, FAQ, posts), showing its text and which page it's on
   - sample posts still published
   - empty optional fields that matter: enquiries.accessKey (say "Jack will set this up"), hero.badge, about.stats
   Each item links to the screen where it's fixed. Show a count ("13 things to confirm"), and a tick when none are left. Plain English, Peter-friendly, matching the admin's existing style. It must work in demo mode and live mode.
5. Check in the browser: a sample post card and page show the label on a PREVIEW build and not on a normal build; the dashboard list matches `grep -o '<mark>' -r src/content src/data | wc -l`.
```

## 5. Automated tests

```
Step 5: add behaviour tests (AUDIT.md finding 9). There are none yet; CI only checks types, build, HTML, links and Lighthouse.

1. Unit tests with Vitest (add `npm test`). Cover the pure logic:
   - src/admin/markdown.ts: Markdown → HTML → Markdown round trip for headings, bold/italic, nested and ordered lists, links, images with titles (figures), and <mark> placeholders. A round trip must not change the file.
   - src/lib/theme.ts: every preset passes checkPalette in both modes; a deliberately bad palette fails with a useful message; Pentlands produces its exact hand-picked values.
   - src/lib/url.ts (href/absolute/baseLinks with and without a base path), src/lib/schedule.ts, src/lib/tenure.ts, src/lib/slots.ts, src/lib/journal.ts (reading time, topics, pagination).
   - the escaping helper from step 1.
   - every src/data/*.json file parses and has the fields the components read (a cheap guard against an admin save breaking the build; share the shape with step 6 if useful).
2. End-to-end smoke tests with Playwright (Chromium only, to keep CI fast; add `npm run test:e2e`). Run against `astro preview` of a build made with BASE_PATH=/peter-rothwell-website/ and PREVIEW=true, so base-path bugs show up. Cover:
   - home page at 375×812, 1366×768, 1440×900 and 1920×929: no horizontal scroll; first screen and #coaching each exactly one viewport tall above 900 px wide
   - mobile menu opens, traps nothing, closes with Escape, links work
   - light/dark toggle switches and persists across reload
   - carousel: next button advances, pause button stops auto-advance
   - enquiry form in preview demo mode: validation errors show, a valid submit shows the demo success message, nothing is sent
   - journal: list, a post, a topic page, RSS returns XML, 404 page for an unknown URL
   - preview build: robots meta noindex present, robots.txt disallows
   - admin in demo mode: change a price, see it saved, reset demo restores it
   - axe-core (@axe-core/playwright) on home, a post, terms and admin: no serious or critical violations
3. Add both to .github/workflows/checks.yml (install Chromium with caching). Keep the whole Checks workflow under about 5 minutes; report the timing locally.
4. Document the commands in README.md's Checks table.
```

## 6. Admin: save status and tidy-up

```
Step 6: make the admin safe for Peter to use alone (AUDIT.md findings 4 and 14). Run `npm test` and `npm run test:e2e` before and after; they must pass both times.

1. Validate before committing. Before a live save, check the content against the same rules the build uses (src/content.config.ts schemas for posts and policies; the data-file checks from step 5 for JSON). If it fails, don't commit; show a plain-English message pointing at the field ("The post needs a title"). Share the rules between the build and the admin rather than writing them twice, if that's practical without pulling zod/astro into the admin bundle in a heavy way; otherwise mirror them and add a unit test that keeps both in step.
2. Save status. After a live save, the admin currently says the site will update in about a minute. Instead, poll the GitHub Actions API for the Checks and Deploy runs for that commit (the token has Contents access only; check whether the Actions read endpoints work with it for this repo, and if not, request "Actions: read" in the sign-in instructions and admin guide, and degrade gracefully when it's missing). Show: "Updating your site…", then "Live" with a link to the page, or "That change didn't go live. Your site is unchanged and Jack has the details." with a link to the failed run. The dashboard shows the latest deploy's status. Don't poll forever (stop after ~5 minutes) and stop when the tab is hidden.
3. Demo mode: simulate the same states so Peter can see what they look like.
4. Split src/admin/main.ts (3,200 lines) into modules by screen (e.g. src/admin/screens/{dashboard,website,posts,photos,theme,contact,policies}.ts) plus shared helpers. Pure move: no behaviour or wording changes. The e2e admin test and a manual click through every admin screen in demo mode must pass afterwards. Check the admin bundle size didn't grow.
5. Update docs/admin-guide.md for anything Peter will now see (the "Still to do" list from step 4, the save status, the "keep me signed in" box from step 1).
```

## 7. SEO polish

```
Step 7: SEO polish (AUDIT.md finding 15). Small changes only.

1. Sitemap lastmod: add lastmod for blog posts (from their date, or an updated date if the schema has one) via @astrojs/sitemap's serialize. Leave other pages without one rather than inventing a date.
2. Blog posts: add BreadcrumbList JSON-LD (Home › Training journal › post) and make sure BlogPosting has image, dateModified (falls back to datePublished), author and publisher. Use the escaping helper from step 1.
3. Write a small script (scripts/check-seo.mjs, run after a build, add to CI) that fails if any public page in dist/ is missing a <title>, meta description, canonical or og:image, or if two pages share a title or description. Fix whatever it finds (topic and pagination pages are the likely duplicates; give them distinct titles like "Strength | Training journal, page 2").
4. Run Lighthouse once on a normal build (PREVIEW unset) and confirm SEO is 100 on /, /journal/ and a post. Then return to PREVIEW=true for everything else.
```

## 8. Full test, commit and deploy

```
Step 8: full test, then commit and push to update the GitHub Pages preview. I'm asking you to commit and push in this step.

1. Clean run, in this order, all must pass (fix anything that fails, then restart the list):
   npm ci
   npm run format:check
   npm run check
   npm test
   npm run build
   npm run validate:html
   npm run check:links
   node scripts/check-seo.mjs
   npm run test:e2e
   PREVIEW=true npm run lhci   (stop any other astro preview first)
   npm audit --omit=dev
2. Manual browser pass on a BASE_PATH=/peter-rothwell-website/ PREVIEW=true build (launch config "built"):
   - home at 1920×929, 1440×900, 1366×768 and 375×812, in dark and light mode: first screen and Ways to train each fill one screen on desktop, no sideways scroll on mobile, no console errors
   - a sample post shows its "Example post" label; the 404 page; the journal topic pages
   - admin in demo mode: the "Still to do" list, edit a price, write a post, crop a photo, change colours, reset demo
   Take screenshots of the home page at 1440×900 and 375×812 and show them to me.
3. Update AUDIT.md: add a short "Re-audit after round 2" section at the top with the new scores per area (same weights), the test results table, and which findings are fixed. Be honest: content Peter hasn't supplied still counts against the Content score. Add your out-of-scope list from the session as "Next".
4. Review `git status` and `git diff` yourself. Make sure nothing unintended is included: no lighthouse-reports/, .lighthouseci/, test output, screenshots or temporary test text. Leave "docs/Peter - Finishing your website.docx" uncommitted unless I say otherwise.
5. Commit in logical commits (roughly one per step), with clear messages, then push to origin main.
6. Watch the run: `gh run watch` for Checks, then the "Deploy to GitHub Pages" run that follows it. If either fails, fix, commit and push again.
7. Open the live preview URL in the browser and check: home loads under the base path, photos show, the preview bar and noindex are present, a blog post and /admin/ load. Then give me the URL, the final score and a summary of the session.
```
