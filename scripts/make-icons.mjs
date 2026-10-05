// Generates the share image and app icons in public/:
//   og-default.png        1200×630, used when a page is shared on social media
//   apple-touch-icon.png  180×180, from public/favicon.svg
// Run with: npm run icons
import { readFileSync, writeFileSync } from 'node:fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const root = new URL('../', import.meta.url);
const font = (path) => readFileSync(new URL(`node_modules/@fontsource/${path}`, root));

// Same colours as src/styles/global.css.
const granite = '#1b211e';
const chalk = '#eeede8';
const gorse = '#e3b23c';
const line = '#34403a';

// The mountain mark from src/components/Logo.astro.
const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34" fill="none"><path d="M2 28 L11 14 L16 20 L23 8 L32 28 Z" stroke="${gorse}" stroke-width="2.5" stroke-linejoin="round"/></svg>`;

const el = (type, style, children) => ({ type, props: { style, children } });

const og = await satori(
  el(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '0 96px',
      background: granite,
      borderBottom: `16px solid ${gorse}`,
    },
    [
      {
        type: 'img',
        props: { src: `data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}`, width: 136, height: 136 },
      },
      el(
        'div',
        {
          marginTop: 28,
          fontFamily: 'Sofia Sans Extra Condensed',
          fontWeight: 900,
          fontSize: 168,
          lineHeight: 0.88,
          letterSpacing: '-0.01em',
          color: chalk,
        },
        'ROTHWELLS RUNNING',
      ),
      el(
        'div',
        {
          marginTop: 40,
          paddingTop: 28,
          borderTop: `2px solid ${line}`,
          fontFamily: 'JetBrains Mono',
          fontWeight: 500,
          fontSize: 32,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: gorse,
        },
        'Running & strength coaching · Edinburgh & online',
      ),
    ],
  ),
  {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: 'Sofia Sans Extra Condensed',
        weight: 900,
        data: font('sofia-sans-extra-condensed/files/sofia-sans-extra-condensed-latin-900-normal.woff'),
      },
      { name: 'JetBrains Mono', weight: 500, data: font('jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff') },
    ],
  },
);

const png = (svg, width) => new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();

writeFileSync(new URL('public/og-default.png', root), png(og, 1200));

// iOS ignores transparency and rounds the corners itself, so fill the whole square.
const favicon = readFileSync(new URL('public/favicon.svg', root), 'utf8').replace(' rx="7"', '');
writeFileSync(new URL('public/apple-touch-icon.png', root), png(favicon, 180));
for (const size of [192, 512]) writeFileSync(new URL(`public/icon-${size}.png`, root), png(favicon, size));

console.log('Wrote og-default.png, apple-touch-icon.png, icon-192.png and icon-512.png in public/');
