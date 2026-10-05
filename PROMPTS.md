# Pre-launch handoff prompts

Everything that can be built **before launch**, with no paid services, accounts or keys, so the GitHub Pages preview is as complete as possible to show Peter.

Paste one prompt into a new Claude Code session opened in this folder. Project context, design rules and content rules load automatically from `AGENTS.md`, so the prompts don't repeat them.

Run them in this order: later prompts assume earlier ones are done. Prompts 7 to 9 can run in any order.

| # | Prompt | Why it matters for the client demo |
| --- | --- | --- |
| 1 | GitHub preview with preview protection | Gives Peter a link to look at |
| 2 | SEO foundations | Proper share previews when the link is sent on WhatsApp |
| 3 | Image pipeline | Photos won't slow the site down |
| 4 | Demo photos | The site looks finished instead of full of grey boxes |
| 5 | Preview demo modes | The form and Instagram grid can be tried out |
| 6 | Admin area with demo mode | Peter can try editing his own site |
| 7 | "How it works" and FAQ | Answers questions before people enquire |
| 8 | Journal improvements | The blog feels complete |
| 9 | Automated checks | Nothing breaks unnoticed as changes are made |
| 10 | Accessibility review | Final pass once everything above is in |

Still for after launch (see AUDIT.md prompt 5 and LAUNCH.md): connecting Web3Forms, the Instagram token, the move to Cloudflare, Turnstile, Email Routing and analytics.

---

## 1. GitHub preview with preview protection

```
Set this project up for client preview on GitHub Pages.

1. Make the first git commit (check .gitignore covers node_modules, dist, .astro, public/instagram). Ask me for the repository name and whether it should be public (GitHub Pages on a free plan needs public), then create it with `gh repo create` and push main.
2. Preview protection. In .github/workflows/deploy.yml set PREVIEW=true for the build step. When PREVIEW is "true":
   - Base.astro adds <meta name="robots" content="noindex, nofollow">
   - the build outputs a robots.txt that disallows everything (generate it from src/pages/robots.txt.ts so it depends on the env var)
   - a slim, dismissible "Preview site, not live yet" bar shows at the top of every page (granite background, gorse text, mono label; it must not break the one-screen hero, so subtract its height or overlay it)
   When PREVIEW is not set, none of this appears and robots.txt allows everything.
3. Turn on Pages (source: GitHub Actions) with `gh api`, wait for the workflow, and give me the live preview URL. Check it in the browser: pages load under the /<repo>/ base path, links work, robots.txt disallows, and the noindex meta is present.
```

## 2. SEO foundations

```
Add SEO foundations, so the site is ready for Google at launch and shared links look good now.

1. Add @astrojs/sitemap. Exclude the old Wix redirect pages (/english-*, /accessibility-statement) and anything under /admin. Link it from robots.txt when PREVIEW isn't set.
2. Create a default share image at public/og-default.png (1200×630) in the site's style: granite background, "ROTHWELLS RUNNING" in Big Shoulders Display, the mountain logo from Logo.astro in gorse, and the line "Running & strength coaching · Edinburgh & online". Generate it with a script (e.g. satori + @resvg/resvg-js, using the Fontsource font files) so it can be regenerated, and keep the script in scripts/.
3. In Base.astro add og:image (absolute URL), og:url, og:site_name, og:locale en_GB, and twitter:card summary_large_image. Blog posts use their cover image when they have one.
4. Add JSON-LD from the data files (src/data/site.json, services.json): on the home page, a LocalBusiness with name, url, telephone, email, address (1 Moray Park, Meadowbank, Edinburgh EH7 5TS), sameAs (Instagram), and makesOffer for each service with its price in GBP, plus a Person for Peter Rothwell. On blog posts, a BlogPosting. Validate the output against schema.org types.
5. Add a branded 404 page (src/pages/404.astro): a big display heading ("Wrong turn"), a short line, and buttons to the home page and coaching plans.
6. Add a 180×180 apple-touch-icon and a web manifest (name, short_name, theme colour #1b211e) based on public/favicon.svg.
Run the build and show me each item in the output.
```

## 3. Image pipeline

```
Prepare image handling so real photos don't hurt performance. Do this before any photos are added.

1. src/components/Photo.astro: add a `priority` prop. When true use loading="eager", fetchpriority="high"; otherwise keep lazy loading. Use priority on the hero photo (Hero.astro). The hero photo stretches to fill the remaining screen height, so make sure the image covers its box at any size (object-fit: cover, with an object-position prop for choosing the focal point).
2. Every <Image> must output width and height, use avif/webp, and have `sizes` that match its layout: hero about 40vw on desktop and 100vw below 900px; About portrait about 45vw; blog cards about 33vw; blog post cover up to 1240px.
3. Instagram: change scripts/fetch-instagram.mjs to save images into src/assets/instagram/ (gitignored), and render them in InstagramFeed.astro through astro:assets as about 400px squares with width and height. Keep the placeholder tiles when there are no posts.
4. Set build.inlineStylesheets to 'always' in astro.config.mjs and preload the latin Big Shoulders Display 900 font file used by the hero headline.
5. Test with a few temporary large images. Run Lighthouse (mobile) on `npm run build && npx astro preview`: Performance ≥ 95, CLS < 0.05, and no render-blocking warning. Remove the temporary images afterwards and tell me the before and after numbers.
```

## 4. Demo photos

```
The site has grey placeholder boxes where photos go, which makes the client preview look unfinished. Add temporary demo photos so Peter sees the real look, while making it obvious they get replaced.

1. If there's a folder of Peter's own photos at [FOLDER, or "none"], use those first.
2. Otherwise use free-licence stock photos from Unsplash or Pexels (their licences allow this). Ask me before downloading anything, listing each file, its source page and size. Choose:
   - hero: a trail or hill runner in action, moody light, landscape, room for the photo to crop tall
   - About portrait: a runner or coach outdoors, face not clearly identifiable (it isn't Peter)
   - three blog covers matching the sample posts (squats/strength, an ultra trail race, race-day fuel)
   - six square images for the Instagram demo grid (running, strength training, group runs)
3. Put them in src/assets/demo/ and record each one in src/assets/demo/CREDITS.md (photographer, source URL, licence).
4. Wire them in through Photo.astro (using the priority and object-position props if prompt 3 is done). Add a `demo` flag so each demo photo shows a tiny "Demo photo" label in its corner, visible only when PREVIEW is "true".
5. Write proper alt text for each.
6. Add a step to LAUNCH.md section 8: "Replace all demo photos (src/assets/demo/) with Peter's own, and delete the folder."
Check the home page at 1440×900 and 375px wide, including that faces aren't cropped badly in the hero.
```

## 5. Preview demo modes for the form and Instagram

```
On the preview site the enquiry form and Instagram grid aren't connected to real services yet. Make both demonstrable to the client without sending anything anywhere.

1. Enquiry form (src/components/EnquiryForm.astro): when PREVIEW is "true" and no access key is set, a correctly filled form shows the normal success screen, plus a clear note: "Preview only: this message wasn't sent. When the site is live it goes straight to Peter's email." Show a small inline sample of the email Peter would receive (subject line "New enquiry: … from …", name, email, phone, interest and message), so he understands what he'd get. Keep every spam check active, and send no network request.
2. Instagram (src/components/InstagramFeed.astro): when there are no real posts and PREVIEW is "true", show the six demo images from src/assets/demo/ (from prompt 4, if present) with a small "Demo" label and a line under the grid: "Preview: this grid fills with Peter's latest Instagram posts automatically once connected." Without PREVIEW, keep the current placeholders.
3. Production builds (PREVIEW unset) must behave exactly as now. Build once each way and confirm.
Test the form in the browser: bot-style instant submit, honeypot filled, too many links, empty fields, and a proper human submission. Confirm no network request is made in preview mode.
```

## 6. Admin area with demo mode

```
Build the admin area at /admin for Peter, who isn't confident with websites. Design mockups are on the "Admin — Dashboard" and "Admin — Write a post" artboards at https://claude.ai/artifact/3Ny5cGNSJTWcKYYAeVur8z (read them with the Artifact tool and match them closely).

The site is static, with no server or database. Content is the files listed in AGENTS.md. The admin reads and writes those files through the GitHub REST API (contents endpoint), committing to main, which triggers the existing deploy workflow.

Build it with two modes:
- **Demo mode** (the default on the preview site; no sign-in): everything works, but changes are kept only in this browser (localStorage), and a banner explains "Demo: changes aren't saved to the website". Publishing a post shows what would happen ("Your post would appear on the site in about a minute") and lets the demo preview the post. A "Reset demo" button clears everything. This is what Peter will try first.
- **Live mode**: sign in with GitHub, using a fine-grained personal access token pasted once (repo contents: read and write), stored in localStorage, with a clear "Sign out". Explain in the README why this was chosen over OAuth, which would need a server. Commits use clear messages like "Update prices (via admin)".

Screens (both modes):
1. Dashboard as in the mockup: "Morning, Peter" (time of day aware); big buttons for "Write a blog post", "Change prices", "Set Run Club dates", "Add a testimonial"; the list of posts with Draft/Live status; and Instagram feed status from src/data/instagram.json.
2. Post editor: title, cover photo (drag-drop or choose; resized in the browser to max 2000px; committed to src/assets/journal/), a simple rich text editor that saves Markdown (heading, bold, italic, list, link, photo), topic, draft or publish, preview, and auto-saved drafts.
3. Simple forms for prices and plan details (services.json), testimonials (with a "Client agreed to this being published" tick box that must be ticked), the week strip, contact details, and the four policy pages (plain Markdown editor with preview; highlight any remaining <mark> placeholders).
4. Validate everything before saving and show friendly, specific errors.
5. Big touch targets; works well on a phone; the site's fonts and colours; light theme for readability.
6. /admin is noindex and excluded from the sitemap.
Keep the JavaScript self-contained to /admin (a small Preact or vanilla TS app is fine) so public pages stay as light as now. Write docs/admin-guide.md for Peter in plain English with short numbered steps. Test every screen in demo mode in the browser at desktop and phone widths.
```

## 7. "How it works" and FAQ

```
Add two sections to the home page that answer common questions before people enquire.

1. "How it works", between the plans section and "Meet your coach": three real steps, because the order matters: (1) "Free 15-minute chat", (2) "Your plan, written for you", (3) "Train, check in, adjust". One short sentence each. Keep it compact. It must not affect the one-screen "Ways to train" section above it.
2. "Questions", just before the Instagram section: an accessible accordion (native <details>/<summary>) with about 6 questions, stored in a new src/data/faq.json so the admin can edit them later. Suggested questions: Do I need to be a runner already? Can I do online coaching if I'm not in Edinburgh? What happens in the first chat? What do I need for Run Club? Can I pause my plan? How do I pay?
   Write answers only from facts in src/data/*.json and src/content/legal/terms.md. Where an answer needs something Peter hasn't confirmed, use a <mark>[Peter to confirm: …]</mark> placeholder.
3. Add FAQPage JSON-LD generated from faq.json.
4. Match the design: chalk or granite section, display heading, mono labels, gorse accent.
Check at 1440×900 and 375px wide.
```

## 8. Journal improvements

```
Improve the blog ("Training journal"): posts are in src/content/journal/, pages in src/pages/journal/.

1. RSS feed with @astrojs/rss at /journal/rss.xml, linked in Base.astro's <head>.
2. Reading time on cards and posts (words ÷ 230, rounded up, e.g. "4 min read").
3. Topic filter on /journal/: links to static pages at /journal/topic/[topic]/ (no client-side JS).
4. On each post: previous/next post links and an end-of-post call to action ("Want a plan like this? Book a free chat") linking to /#coaching and /#contact.
5. Pagination at /journal/page/2/ etc. once there are more than 12 posts (test with temporary posts, then delete them).
6. A better post layout: wider pull quotes (Markdown blockquote), styled lists, images with captions (Markdown image title), and a table style.
Match the existing light chalk design. Use href() for every link.
```

## 9. Automated checks

```
Add automated checks so changes (including ones from the admin area) can't silently break the site.

1. Install @astrojs/check and typescript; add "check": "astro check" to package.json; fix any errors it finds.
2. Add .github/workflows/checks.yml, running on pull requests and pushes to main: npm ci, npm run check, npm run build, an offline internal link check on dist/ (linkinator or lychee), and html-validate on dist/**/*.html (configure sensible rules; don't weaken them just to pass).
3. Add Lighthouse CI (@lhci/cli) against `astro preview` for /, /journal/ and /terms/, with mobile budgets: performance ≥ 90, accessibility 100, best practices ≥ 95. Skip the SEO category when PREVIEW is "true" (preview pages are noindex on purpose).
4. Add Prettier with prettier-plugin-astro matching the current style (2-space indent, single quotes, 120 columns), format the codebase in one separate commit, and add a format check to CI.
5. Make the deploy workflow wait for the checks to pass.
The whole check run should take under 3 minutes. Show me a passing run.
```

## 10. Accessibility review

```
Do a manual accessibility review against WCAG 2.2 AA, beyond what Lighthouse checks. Run this last, after the other prompts.

1. Keyboard only, on every page: the mobile menu (<details> in Header.astro), the testimonials carousel (Testimonials.astro), the FAQ accordion, the enquiry form and its success screen, the preview bar, and the admin area. Check focus order, visible focus, no traps, and that focus goes somewhere sensible after each action.
2. Screen reader semantics: check the accessibility tree for the hero headline, the week strip (<ol>), the price cards, the carousel (off-screen reviews reachable; arrows labelled; position announced), the form's errors and success (role=status), and the map link.
3. Reflow at 400% zoom (320 CSS px), text-spacing overrides, prefers-reduced-motion, and Windows high contrast mode (forced-colors).
4. Contrast of every text and background pair, including placeholder text, mono labels on chalk, and yellow on dark.
Fix what you find. Then rewrite the "How this was checked" section of src/content/legal/accessibility.md to say what was tested and how, and remove its placeholder.
```
