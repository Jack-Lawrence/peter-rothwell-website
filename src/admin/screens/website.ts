// "Your website": the list of sections, and the wording screens for each one.
import { h, field, textInput, Errors, errorSummary, toast } from '../ui';
import { textGroup, setPath } from '../text-fields';
import { PATHS, readJson, toJson, save, savedMessage, screen, heading, trackDirty } from '../app';
import { instagramBox } from './dashboard';

// ---------- Your website: every section, in page order ----------

export type Site = Record<string, unknown>;
/** Part of a section form: a box of fields that checks itself and writes into site.json. */
export interface Part {
  box: HTMLElement;
  check(errors: Errors): void;
  apply(site: Site): Site;
}

// The public site's home page, worked out from where the editor is (…/admin/).
export const siteRoot = new URL('../', location.href.split('#')[0]).href;

export const SECTIONS: { route: string; title: string; sub: string }[] = [
  { route: 'menu', title: 'Menu and footer', sub: 'Menu links, the main button, and the bottom of every page' },
  { route: 'hero', title: 'Top of the page', sub: 'The big headline, introduction and buttons' },
  { route: 'week', title: 'Typical week', sub: 'The week of training under the headline' },
  { route: 'prices', title: 'Ways to train', sub: 'Your plans, prices and where you train' },
  { route: 'runclub', title: 'Run Club', sub: 'What it says, the details and the next block' },
  { route: 'about', title: 'Meet your coach', sub: 'Your name and a few words about you' },
  { route: 'testimonials', title: 'Reviews', sub: 'What clients say about you' },
  { route: 'instagram', title: 'Instagram', sub: 'The heading and button above your posts' },
  { route: 'journal', title: 'Training journal', sub: 'The headings for your blog' },
  { route: 'faq', title: 'Questions', sub: 'Common questions and your answers' },
  { route: 'getintouch', title: 'Get in touch', sub: 'The contact section and the enquiry form' },
];

export function websiteScreen() {
  screen(
    'Your website',
    heading(
      'Your website',
      'Every part of your home page, from top to bottom. Tap one to change its words, or anything in it.',
    ),
    h(
      'section',
      { class: 'box' },
      h(
        'ol',
        { class: 'rows' },
        SECTIONS.map((s) =>
          h(
            'li',
            {},
            h(
              'a',
              { class: 'row', href: `#/${s.route}` },
              h('span', { class: 'row-text' }, h('b', {}, s.title), h('span', { class: 'sub' }, s.sub)),
              h('span', { class: 'row-go', 'aria-hidden': 'true' }, '→'),
            ),
          ),
        ),
      ),
    ),
    h(
      'p',
      { class: 'hint' },
      'Blog posts, photos, colours, contact details and policies have their own pages in the menu.',
    ),
  );
}

/** Page heading for a section: back to Your website, plus a link to see it on the live site. */
export function sectionHeading(title: string, intro: string, anchor?: string) {
  const head = heading(title, intro, ['#/website', 'Your website']);
  if (anchor !== undefined)
    head.append(
      h(
        'p',
        { class: 'see-live' },
        h('a', { href: `${siteRoot}${anchor}`, target: '_blank', rel: 'noopener' }, 'See this on your website ↗'),
      ),
    );
  return head;
}

/** A box pointing to where something else is changed, e.g. photos. */
export const infoBox = (title: string, text: string, links: [string, string][]) =>
  h(
    'div',
    { class: 'box' },
    h('h2', {}, title),
    h('p', {}, text),
    h(
      'div',
      { class: 'row-actions' },
      links.map(([label, to]) => h('a', { class: 'btn btn--small', href: to }, label)),
    ),
  );

/** A section whose wording all lives in site.json. */
export async function sectionScreen(o: {
  title: string;
  intro: string;
  anchor?: string;
  message: string;
  parts: (site: Site) => (Part | HTMLElement)[];
}) {
  const site = await readJson<Site>(PATHS.site);
  const summary = errorSummary();
  const items = o.parts(site);
  const parts = items.filter((p): p is Part => !(p instanceof HTMLElement));
  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save changes');
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        parts.forEach((p) => p.check(errors));
        if (!errors.show()) return;
        const next = parts.reduce((s, p) => p.apply(s), site);
        if (await save([{ path: PATHS.site, text: toJson(next) }], o.message, saveBtn)) toast(savedMessage());
      }) as EventListener,
    },
    items.map((p) => (p instanceof HTMLElement ? p : p.box)),
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(o.title, sectionHeading(o.title, o.intro, o.anchor), summary, form);
}

export const menuScreen = () =>
  sectionScreen({
    title: 'Menu and footer',
    intro:
      'The links at the top of every page, the main button, the bottom of every page and the buttons on the photos.',
    message: 'Update menu and footer',
    parts: (site) => [
      textGroup(site, 'Menu links', [
        { path: 'nav.coaching', label: 'Link to your plans', max: 20 },
        { path: 'nav.runClub', label: 'Link to the Run Club', max: 20 },
        { path: 'nav.about', label: 'Link to Meet your coach', max: 20 },
        { path: 'nav.journal', label: 'Link to your blog', max: 20 },
        {
          path: 'nav.cta',
          label: 'Main button',
          max: 24,
          hint: 'The yellow button at the top. It goes to the contact section.',
        },
      ]),
      textGroup(site, 'Bottom of every page', [
        {
          path: 'footer.text',
          label: 'A few words about you',
          kind: 'text',
          max: 220,
          hint: 'Shown beside your logo.',
        },
      ]),
      textGroup(
        site,
        'Buttons on the photos',
        [
          { path: 'carousel.next', label: 'Next photo button', max: 30 },
          { path: 'carousel.pause', label: 'Pause button', max: 30 },
          { path: 'carousel.play', label: 'Play button (after pausing)', max: 30 },
          { path: 'hero.photosLabel', label: 'Name of the photos at the top', max: 40 },
          { path: 'runClub.photosLabel', label: 'Name of the Run Club photos', max: 40 },
        ],
        'The photos at the top of the home page and in the Run Club change every few seconds. These small buttons and names aren’t shown as words: screen readers read them out for people who can’t see the page.',
      ),
      textGroup(site, 'Your business name and Google', [
        {
          path: 'name',
          label: 'Business name',
          max: 24,
          hint: 'Shown in the logo, on browser tabs and in Google.',
        },
        {
          path: 'description',
          label: 'Description for Google',
          kind: 'text',
          max: 160,
          hint: 'Shown under your website in Google’s search results. One or two sentences.',
        },
      ]),
    ],
  });

export const heroScreen = () =>
  sectionScreen({
    title: 'Top of the page',
    intro: 'The first thing people see: the big headline, a short introduction and two buttons.',
    anchor: '',
    message: 'Update top of the home page',
    parts: (site) => [
      textGroup(site, 'Words', [
        {
          path: 'hero.eyebrow',
          label: 'Small line above the headline',
          max: 90,
          hint: 'e.g. “Running & strength coaching · Meadowbank, Edinburgh & online”',
        },
        {
          path: 'hero.headline',
          label: 'Headline',
          kind: 'lines',
          most: 4,
          max: 20,
          hint: 'One short line per line, up to 4. The last line shows in your highlight colour.',
        },
        { path: 'hero.intro', label: 'Introduction', kind: 'text', max: 300 },
      ]),
      textGroup(site, 'Buttons', [
        { path: 'hero.buttons.primary', label: 'Main button (goes to your plans)', max: 26 },
        { path: 'hero.buttons.secondary', label: 'Second button (goes to the Run Club)', max: 26 },
      ]),
      textGroup(
        site,
        'Badge on the photo',
        [
          { path: 'hero.badge.label', label: 'Small line', max: 24, optional: true, hint: 'e.g. “Longest run”' },
          {
            path: 'hero.badge.value',
            label: 'Big text',
            max: 12,
            optional: true,
            hint: 'e.g. “100 km”. Leave this empty to hide the badge.',
          },
        ],
        'A small box in the corner of the top photo, for one number you’re proud of.',
      ),
      infoBox('Photos', 'The photos beside the headline are changed in Photos.', [['Change photos', '#/photos']]),
    ],
  });

export const aboutScreen = () =>
  sectionScreen({
    title: 'Meet your coach',
    intro: 'Your name, a few words about you and, if you like, some numbers.',
    anchor: '#about',
    message: 'Update Meet your coach',
    parts: (site) => [
      textGroup(site, 'Words', [
        { path: 'about.eyebrow', label: 'Small heading', max: 40, hint: 'e.g. “Meet your coach”' },
        { path: 'about.name', label: 'Big heading', max: 40, hint: 'Usually your name.' },
        {
          path: 'about.paragraphs',
          label: 'About you',
          kind: 'paras',
          most: 4,
          max: 700,
          hint: 'Leave an empty line between paragraphs.',
        },
      ]),
      statsPart(site),
      infoBox('Photo', 'Your photo is changed in Photos.', [['Change photo', '#/photos']]),
    ],
  });

/** Up to three big numbers under the About text, e.g. "12" / "Ultras finished". Empty ones are hidden. */
export function statsPart(site: Site): Part {
  const stats = ((site.about as { stats?: { value: string; label: string }[] }).stats ?? []).slice(0, 3);
  const rows = [0, 1, 2].map((i) => ({
    value: field(`Number ${i + 1}`, textInput(stats[i]?.value ?? '', { maxlength: 8 }), i === 0 ? 'e.g. “12”' : ''),
    label: field(
      `What it means`,
      textInput(stats[i]?.label ?? '', { maxlength: 30 }),
      i === 0 ? 'e.g. “Ultras finished”' : '',
    ),
  }));
  return {
    box: h(
      'fieldset',
      { class: 'box' },
      h('legend', {}, 'Numbers (optional)'),
      h('p', { class: 'hint' }, 'Up to three big numbers shown under your words. Leave them empty to hide them.'),
      rows.map((r) => h('div', { class: 'pair' }, r.value.wrap, r.label.wrap)),
    ),
    check(errors) {
      rows.forEach((r, i) => {
        const v = r.value.input.value.trim();
        const l = r.label.input.value.trim();
        if (v && !l) errors.add(r.label, `Number ${i + 1}: say what the number means.`);
        if (l && !v) errors.add(r.value, `Number ${i + 1}: add the number, or clear what it means.`);
      });
    },
    apply(next) {
      const list = rows
        .map((r) => ({ value: r.value.input.value.trim(), label: r.label.input.value.trim() }))
        .filter((s) => s.value && s.label);
      return setPath(next, 'about.stats', list);
    },
  };
}

export const journalScreen = () =>
  sectionScreen({
    title: 'Training journal',
    intro: 'The headings for your blog, on the home page and on the blog page.',
    anchor: 'journal/',
    message: 'Update training journal headings',
    parts: (site) => [
      textGroup(site, 'Headings', [
        {
          path: 'journal.title',
          label: 'Heading',
          max: 40,
          hint: 'Shown on your home page and at the top of your blog page.',
        },
        { path: 'journal.allPosts', label: 'Link to all your posts', max: 24 },
        {
          path: 'journal.sampleLabel',
          label: 'Label on example posts',
          max: 60,
          hint: 'Only on the preview website, on the example posts Jack wrote. A post loses it once you save it.',
        },
      ]),
      textGroup(site, 'For Google', [
        {
          path: 'journal.intro',
          label: 'Description of your blog',
          kind: 'text',
          max: 160,
          hint: 'Shown in Google’s search results, not on the page.',
        },
      ]),
      infoBox('Posts', 'To write a new post or change one, go to Blog posts.', [
        ['Write a blog post', '#/post/new'],
        ['See all posts', '#/posts'],
      ]),
    ],
  });

export const getInTouchScreen = () =>
  sectionScreen({
    title: 'Get in touch',
    intro: 'The yellow contact section at the bottom of every page, and the enquiry form in it.',
    anchor: '#contact',
    message: 'Update Get in touch',
    parts: (site) => [
      textGroup(site, 'Contact section', [
        { path: 'getInTouch.eyebrow', label: 'Small heading', max: 40 },
        { path: 'getInTouch.title', label: 'Big heading', max: 60 },
        { path: 'getInTouch.intro', label: 'Introduction', kind: 'text', max: 250 },
      ]),
      textGroup(site, 'Enquiry form', [
        { path: 'getInTouch.formTitle', label: 'Form heading', max: 40 },
        { path: 'getInTouch.formIntro', label: 'Line under the heading', kind: 'text', max: 200 },
        {
          path: 'getInTouch.placeholder',
          label: 'Example text in the message box',
          max: 100,
          hint: 'Shown in grey until they start typing.',
        },
        {
          path: 'getInTouch.note',
          label: 'Note above the button',
          kind: 'text',
          max: 300,
          hint: 'A link to your Privacy Policy is added after it.',
        },
        { path: 'getInTouch.button', label: 'Send button', max: 24 },
        {
          path: 'getInTouch.thanks',
          label: 'Thank-you message',
          kind: 'text',
          max: 200,
          hint: 'Shown after someone sends the form. If it starts with “Thanks”, their first name is added: “Thanks, Sam.”',
        },
      ]),
      textGroup(
        site,
        '“I’m interested in” choices',
        [
          {
            path: 'enquiries.interests',
            label: 'Other choices',
            kind: 'lines',
            most: 5,
            max: 40,
            optional: true,
            hint: 'One per line, e.g. “Something else”.',
          },
        ],
        'Your plans are listed automatically, so a new or renamed plan appears by itself. Add any other choices here.',
      ),
      infoBox('Phone, email and address', 'These are changed in Contact details.', [
        ['Change contact details', '#/contact'],
      ]),
    ],
  });

// ---------- Instagram ----------

export async function instagramScreen() {
  const insta = await readJson<{ updated: string | null; posts: unknown[] }>(PATHS.instagram);
  await sectionScreen({
    title: 'Instagram',
    intro: 'Your latest Instagram posts show on the home page by themselves. You can change the words around them.',
    message: 'Update Instagram section',
    parts: (site) => [
      textGroup(
        site,
        'Words',
        [
          { path: 'instagram.eyebrow', label: 'Small heading', max: 40 },
          { path: 'instagram.button', label: 'Button', max: 26, hint: 'It opens your Instagram page.' },
        ],
        'The big heading is your Instagram name, from Contact details.',
      ),
      instagramBox(insta),
    ],
  });
}
