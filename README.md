# Rothwells Running

Website for Peter Rothwell, running and strength coach in Edinburgh. Built with [Astro](https://astro.build) as a static site.

## Run it locally

```sh
npm install
npm run dev
```

Open http://localhost:4321.

## Where the content lives

Everything Peter can change is a plain file, so the admin area at `/admin` can edit it by committing to this repo.

| What                                        | File                         |
| ------------------------------------------- | ---------------------------- |
| Hero text, About, contact details, location | `src/data/site.json`         |
| Coaching plans and prices                   | `src/data/services.json`     |
| Testimonials                                | `src/data/testimonials.json` |
| "Typical week" strip                        | `src/data/week.json`         |
| Blog posts                                  | `src/content/journal/*.md`   |
| Privacy, terms, refunds, accessibility      | `src/content/legal/*.md`     |
| Instagram feed (generated)                  | `src/data/instagram.json`    |
| Photos uploaded in the admin area           | `src/assets/journal/`        |

Optional fields that are left empty are hidden: `hero.badge` (e.g. "Longest run / 100 km") and `about.stats` (e.g. `[{ "value": "12", "label": "Ultras finished" }]`).

## Before launch

- [ ] Replace the photo placeholders (hero, About, blog covers)
- [ ] Delete the three sample posts in `src/content/journal/` (marked `sample: true`)
- [ ] Peter to confirm what's included in each plan in `services.json`
- [ ] Add hero badge and About stats if wanted
- [ ] Peter to review the policy pages in `src/content/legal/` and fill in every highlighted `<mark>` placeholder (payment method, notice periods, insurer, ICO number, retention periods)

## Admin area (`/admin`)

A small app for Peter to edit the content files above: blog posts (with a simple editor that saves Markdown), every heading, sentence and button on the home page (under "Your website", one screen per section), plans and prices (add, remove, reorder), the Run Club, questions, photos, colours, testimonials, the typical week, contact details and the four policy pages. The code is in `src/admin/` and only loads on `/admin`, so public pages stay light. `/admin` is `noindex` and left out of the sitemap. Peter's instructions are in [docs/admin-guide.md](docs/admin-guide.md).

It has two modes:

- **Demo** (the default on the preview site, no sign-in): everything works, but changes stay in that browser (localStorage). "Reset demo" clears them. Nothing leaves the browser.
- **Live**: Peter signs in once per device by pasting a GitHub fine-grained personal access token. Each save is one commit to `main` (for example "Update prices (via admin)"), which triggers the deploy workflow, so the site updates in about a minute. A post and its photos go up in the same commit. Photos are resized in the browser to at most 2000px before upload.

The repo it commits to is `ADMIN_REPO` (default `Jack-Lawrence/peter-rothwell-website`; set it as an environment variable at build time if the repo moves).

**Why a pasted token, not "Sign in with GitHub" (OAuth)?** GitHub's OAuth flow needs a server to swap the login code for a token while keeping a client secret hidden, and this site deliberately has no server. A fine-grained token can be limited to this one repository and to _Contents: read and write_, expires on a date Peter chooses, and can be revoked at any time on GitHub. It's stored only in Peter's browser (localStorage) and sent only to api.github.com. "Sign out" deletes it. If the site moves to Cloudflare, a small Worker could do the OAuth swap instead, and the admin would need only a new sign-in screen.

To set Peter up: give him a GitHub account with write access to the repo, then follow "Signing in" in the admin guide together.

## Checks

`.github/workflows/checks.yml` runs on pull requests and every push to `main` (including saves from the admin area), and the deploy only goes ahead if it passes. It takes about three minutes:

| Step                                    | Command                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Formatting (Prettier)                   | `npm run format:check` (fix with `npm run format`)                                                          |
| Types                                   | `npm run check`                                                                                             |
| Build                                   | `npm run build`                                                                                             |
| Internal links, offline                 | `npm run check:links`                                                                                       |
| HTML validation (`.htmlvalidate.mjs`)   | `npm run validate:html`                                                                                     |
| Lighthouse, mobile (`lighthouserc.cjs`) | `npm run lhci`: performance ≥ 90, accessibility 100, best practices ≥ 95 (and SEO when not a preview build) |

The content files the admin area writes (`src/data/`, `src/content/`) aren't formatted by Prettier, so a save from Peter can't fail on style. Run the last three after a build; locally, stop any other `astro preview` first (Astro allows one at a time).

## Hosting

### Preview: GitHub Pages

`.github/workflows/deploy.yml` builds and publishes after the checks pass on `main`, and hourly to pick up new Instagram posts. In the repo settings, set **Pages → Source** to **GitHub Actions**. The workflow sets the base path, so the site works at `https://<user>.github.io/<repo>/`.

On the free GitHub plan, Pages needs a public repo. GitHub pauses scheduled workflows after 60 days without any repo activity.

### Live: Cloudflare

Build command `npm run build`, output folder `dist`. No base path is needed. Set `IG_ACCESS_TOKEN` as an environment variable so the feed is fetched during the build.

## Enquiry form

The form in the footer sends enquiries to Peter's email through [Web3Forms](https://web3forms.com) (free plan).

1. At web3forms.com, enter Peter's email to get an access key (it's emailed to him).
2. Put it in `src/data/site.json` → `enquiries.accessKey`. The key is public by design; it only lets the form send to that one address.
3. In the Web3Forms dashboard, restrict the form to the site's domain if the option is available.

Until a key is set, the form tells visitors to text or email instead.

Spam protection is layered (details at the top of `src/components/EnquiryForm.astro`): Web3Forms' server-side filter and `botcheck` honeypot, a second honeypot field, a 4-second time trap, a real-interaction check, link limits and a one-per-minute cooldown. If spam still gets through, set `enquiries.captcha` to `true` to add hCaptcha (free, but it can show visitors a puzzle).

On Cloudflare, this can move to a Worker with Turnstile and Email Routing, which checks everything on the server and has no monthly limit.

## Instagram feed

`scripts/fetch-instagram.mjs` uses the Instagram API with Instagram Login (works for Business and Creator accounts, no Facebook Page needed). At build time it saves the latest six posts and their images. Without a token the site shows placeholder tiles.

1. Create an app at developers.facebook.com, add the **Instagram** product, and generate a long-lived token for @peter_rothwell.pt.
2. Add it as the repo secret `IG_ACCESS_TOKEN`.
3. Tokens last 60 days. `.github/workflows/instagram-token.yml` refreshes it weekly; it needs a second secret, `GH_SECRETS_TOKEN`, a fine-grained personal access token for this repo with **Secrets: read and write**.

To test locally: `IG_ACCESS_TOKEN=... npm run instagram`.
