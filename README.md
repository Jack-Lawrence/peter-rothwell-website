# Rothwells Running

Website for Peter Rothwell, running and strength coach in Edinburgh. Built with [Astro](https://astro.build) as a static site.

## Run it locally

```sh
npm install
npm run dev
```

Open http://localhost:4321.

## Where the content lives

Everything Peter can change is a plain file, so the admin area (coming next) can edit it by committing to this repo.

| What | File |
| --- | --- |
| Hero text, About, contact details, location | `src/data/site.json` |
| Coaching plans and prices | `src/data/services.json` |
| Testimonials | `src/data/testimonials.json` |
| "Typical week" strip | `src/data/week.json` |
| Blog posts | `src/content/journal/*.md` |
| Privacy, terms, refunds, accessibility | `src/content/legal/*.md` |
| Instagram feed (generated) | `src/data/instagram.json` |

Optional fields that are left empty are hidden: `hero.badge` (e.g. "Longest run / 100 km") and `about.stats` (e.g. `[{ "value": "12", "label": "Ultras finished" }]`).

## Before launch

- [ ] Replace the photo placeholders (hero, About, blog covers)
- [ ] Delete the three sample posts in `src/content/journal/` (marked `sample: true`)
- [ ] Peter to confirm what's included in each plan in `services.json`
- [ ] Add hero badge and About stats if wanted
- [ ] Peter to review the policy pages in `src/content/legal/` and fill in every highlighted `<mark>` placeholder (payment method, notice periods, insurer, ICO number, retention periods)

## Hosting

### Preview: GitHub Pages

`.github/workflows/deploy.yml` builds and publishes on every push to `main`, and hourly to pick up new Instagram posts. In the repo settings, set **Pages → Source** to **GitHub Actions**. The workflow sets the base path, so the site works at `https://<user>.github.io/<repo>/`.

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
