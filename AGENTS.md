# Rothwells Running website

Website for Peter Rothwell, a running and strength coach (ultra runner) in Edinburgh. It replaces a Wix site at rothwellsrunning.com. Jack is building it; Peter (the client) is not confident with websites and will edit content through an admin area.

## Current stage

Pre-launch. The site is previewed on **GitHub Pages** so Peter can review it. No third-party services are connected yet (no Web3Forms key, no Instagram token, no Cloudflare). Later it moves to Cloudflare Pages at https://www.rothwellsrunning.com. See README.md, AUDIT.md and LAUNCH.md.

## Stack and structure

- Astro 7, static output, TypeScript, no UI framework. Node 24.
- Content lives in files so the admin area can edit them:
  - `src/data/site.json` (hero, about, contact, location, enquiry form settings)
  - `src/data/services.json`, `src/data/testimonials.json`, `src/data/week.json`, `src/data/instagram.json` (generated)
  - `src/content/journal/*.md` (blog posts), `src/content/legal/*.md` (policies); schemas in `src/content.config.ts`
- Components in `src/components/`, layout in `src/layouts/Base.astro`, global tokens in `src/styles/global.css`.
- The site may be served under a base path (`/<repo>/` on GitHub Pages). Always build internal links with `href()` from `src/lib/url.ts`, never a bare `/path`.

## Design rules

- Direction "Pentlands": dark granite greens (`--granite #1b211e`), chalk light sections (`--chalk #eeede8`), one accent, gorse yellow (`--gorse #e3b23c`). Use the tokens in `global.css`, never new literal colours.
- Light/dark mode (sun/moon button, `ThemeToggle.astro`): dark is the default. Light mode (`html[data-theme="light"]`) swaps the surface tokens (`--granite`, `--granite-2`, `--panel`, `--line`, `--muted`, `--muted-2`, `--chalk`, `--accent`), so granite sections turn light; `.light` sections and the gorse `.footer` keep their colours. Use the surface tokens in granite sections, `--accent` (not `--gorse`) for gorse text and icons, and the fixed `--ink`/`--paper` where a colour must never change (e.g. text on gorse). Check contrast in both modes.
- Fonts (self-hosted via Fontsource): Sofia Sans Extra Condensed (uppercase headings), Figtree (body), JetBrains Mono (small uppercase labels).
- On desktop (> 900px wide), the first screen (hero + week strip) and the "Ways to train" section each fill exactly one screen. Check any change near them at 1920×929, 1440×900 and 1366×768.
- Must work at 375px wide with no sideways scrolling.
- Respect `prefers-reduced-motion`. Keep JavaScript minimal.

## Content rules

- Never invent facts about Peter (numbers, qualifications, prices, policies, reviews). Use a visible placeholder instead: `<mark>[Peter to confirm: …]</mark>` in Markdown, or an empty value that the component hides.
- Write in plain UK English, first person for Peter's own copy.

## Working on this project

- Dev server: `npm run dev` (port 4321). On Windows it sometimes keeps serving old component styles; if a style change doesn't appear, restart it.
- Before finishing, run `npm run build` and check the change in a browser at desktop and phone widths.
- Don't commit or push unless asked.

## Astro documentation

Full documentation: https://docs.astro.build

- [Routing](https://docs.astro.build/en/guides/routing/)
- [Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Content collections](https://docs.astro.build/en/guides/content-collections/)
- [Styling](https://docs.astro.build/en/guides/styling/)
- [Images](https://docs.astro.build/en/guides/images/)
