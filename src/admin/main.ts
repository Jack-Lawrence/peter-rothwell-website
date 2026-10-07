// The admin app: a few simple screens over the website's content files.
import {
  h,
  field,
  textInput,
  textArea,
  Errors,
  errorSummary,
  toast,
  dialog,
  relativeTime,
  formatDate,
  today,
  type Field,
} from './ui';
import {
  demoStore,
  liveStore,
  resetDemo,
  checkToken,
  SaveError,
  TOKEN_KEY,
  type Baked,
  type Store,
  type Change,
} from './store';
import { parseDoc, stringifyDoc, markdownToHtml, htmlToMarkdown, wordCount, slugify, type Front } from './markdown';
import { resizePhoto } from './images';
import { createRichEditor } from './rich-editor';
import { cropPhoto, PhotoError } from './cropper';
import { textGroup, setPath } from './text-fields';
import { SLOTS, type Slot } from '../lib/slots';
import {
  checkPalette,
  derivePalette,
  isHex,
  mix,
  paletteFor,
  DEFAULT_PRESET,
  PRESETS,
  type Palette,
  type ThemeBase,
  type ThemeFile,
} from '../lib/theme';

const config = JSON.parse(document.getElementById('admin-config')!.textContent!) as {
  repo: string;
  preview: boolean;
  siteUrl: string;
  baked: Baked;
};

const PATHS = {
  services: 'src/data/services.json',
  testimonials: 'src/data/testimonials.json',
  week: 'src/data/week.json',
  site: 'src/data/site.json',
  instagram: 'src/data/instagram.json',
  journal: 'src/content/journal',
  legal: 'src/content/legal',
  journalImages: 'src/assets/journal',
  photos: 'src/assets/photos',
  library: 'src/assets/library',
  theme: 'src/data/theme.json',
  faq: 'src/data/faq.json',
};
const MODE_KEY = 'rr-admin-mode';

interface Service {
  id: string;
  label: string;
  name: string;
  price: string;
  per: string;
  points: string[];
  schedule?: { starts: string; when: string; spaces: string };
}
interface Testimonial {
  name: string;
  service: string;
  quote: string;
  consent?: boolean;
  /** YYYY-MM-DD the client started training. */
  started?: string;
  /** YYYY-MM-DD they finished, or "ongoing". */
  ended?: string;
}
interface Week {
  title: string;
  days: { day: string; session: string; note: string; highlight?: boolean }[];
}

// ---------- Mode and store ----------

const storage = {
  get: (k: string, s: Storage = localStorage) => {
    try {
      return s.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string, s: Storage = localStorage) => {
    try {
      s.setItem(k, v);
    } catch {
      /* storage blocked */
    }
  },
  remove: (k: string, s: Storage = localStorage) => {
    try {
      s.removeItem(k);
    } catch {
      /* storage blocked */
    }
  },
};

let store: Store | null = null;

function startStore(): Store | null {
  const token = storage.get(TOKEN_KEY);
  if (token) return liveStore(config.repo, token);
  if (config.preview || storage.get(MODE_KEY, sessionStorage) === 'demo') return demoStore(config.baked);
  return null;
}

const isDemo = () => store?.mode === 'demo';

async function readJson<T>(path: string): Promise<T> {
  const text = await store!.read(path);
  if (text === null) throw new SaveError(`Couldn't find ${path}.`);
  return JSON.parse(text) as T;
}
const toJson = (data: unknown) => `${JSON.stringify(data, null, 2)}\n`;

/** Saves, then tells Peter what happens next. */
async function save(changes: Change[], message: string, button?: HTMLButtonElement): Promise<boolean> {
  const label = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = 'Saving…';
  }
  try {
    await store!.commit(changes, `${message} (via admin)`);
    setDirty(false);
    return true;
  } catch (err) {
    toast(err instanceof SaveError ? err.message : 'Something went wrong while saving. Please try again.', 'error');
    return false;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = label ?? 'Save';
    }
  }
}

const savedMessage = () =>
  isDemo()
    ? 'Saved in this demo. On the real website, the change would appear in about a minute.'
    : 'Saved. Your website will update in about a minute.';

// ---------- Unsaved changes ----------

let dirty = false;
function setDirty(value: boolean) {
  dirty = value;
}
window.addEventListener('beforeunload', (e) => {
  if (dirty) e.preventDefault();
});

// ---------- Layout ----------

const view = document.getElementById('view')!;
const banner = document.getElementById('mode-banner')!;
const sideFoot = document.getElementById('side-foot')!;

function renderChrome() {
  banner.replaceChildren();
  sideFoot.replaceChildren();
  document.body.classList.toggle('is-demo', isDemo());
  if (!store) return;
  if (isDemo()) {
    banner.hidden = false;
    banner.append(
      h('strong', {}, 'Demo: '),
      "changes aren't saved to the website. They stay in this browser so you can try everything out.",
    );
    sideFoot.append(
      h(
        'button',
        {
          type: 'button',
          class: 'side-btn',
          onclick: (async () => {
            const answer = await dialog(
              'Reset the demo?',
              [h('p', {}, 'This clears every change you made in the demo and starts again from the current website.')],
              [
                { label: 'Cancel', value: '' },
                { label: 'Reset demo', value: 'reset', primary: true },
              ],
            );
            if (answer !== 'reset') return;
            resetDemo();
            store = demoStore(config.baked);
            setDirty(false);
            toast('The demo has been reset.');
            location.hash = '#/';
            route();
          }) as EventListener,
        },
        'Reset demo',
      ),
      h('a', { class: 'side-btn', href: '#/signin' }, 'Sign in to the real website'),
    );
  } else {
    banner.hidden = true;
    sideFoot.append(
      h('p', { class: 'side-note' }, 'Signed in. Changes go live.'),
      h(
        'button',
        {
          type: 'button',
          class: 'side-btn',
          onclick: (() => {
            storage.remove(TOKEN_KEY);
            storage.remove(MODE_KEY, sessionStorage);
            store = startStore();
            toast('You are signed out.');
            location.hash = store ? '#/' : '#/signin';
            route();
          }) as EventListener,
        },
        'Sign out',
      ),
    );
  }
}

// Screens reached from "Your website", which stays highlighted in the menu while on them.
const WEBSITE_ROUTES = [
  'menu',
  'hero',
  'week',
  'prices',
  'runclub',
  'about',
  'testimonials',
  'instagram',
  'journal',
  'faq',
  'getintouch',
];

function markNav(hash: string) {
  const name = hash.match(/^#\/([a-z]*)/)?.[1] ?? '';
  document.querySelectorAll<HTMLAnchorElement>('.side-nav a').forEach((a) => {
    const target = a.getAttribute('href')!;
    const on =
      target === '#/'
        ? hash === '#/'
        : hash.startsWith(target) ||
          (target === '#/posts' && hash.startsWith('#/post/')) ||
          (target === '#/website' && WEBSITE_ROUTES.includes(name));
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.querySelector('.side')?.classList.remove('is-open');
  document.getElementById('menu-btn')?.setAttribute('aria-expanded', 'false');
}

function screen(title: string, ...children: (Node | string | null | false)[]) {
  document.title = `${title} | Website editor`;
  view.replaceChildren(...(children.filter(Boolean) as Node[]));
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

const backLink = (href: string, label: string) => h('a', { class: 'back', href }, `← ${label}`);

function heading(title: string, intro?: string, back?: [string, string]) {
  return h(
    'div',
    { class: 'page-head' },
    back && backLink(...back),
    h('h1', {}, title),
    intro && h('p', { class: 'lede' }, intro),
  );
}

// ---------- Router ----------

let routing = 0;
async function route() {
  const hash = location.hash || '#/';
  const run = ++routing;
  markNav(hash);
  renderChrome();

  if (!store && hash !== '#/signin') {
    location.replace('#/signin');
    return;
  }
  view.replaceChildren(h('p', { class: 'loading' }, 'Loading…'));
  try {
    const [, name, arg] = hash.match(/^#\/([a-z]*)\/?(.*)$/) ?? [];
    const screens: Record<string, (arg: string) => Promise<void> | void> = {
      '': dashboard,
      posts: postsList,
      post: postEditor,
      website: websiteScreen,
      menu: menuScreen,
      hero: heroScreen,
      prices: pricesScreen,
      runclub: runClubScreen,
      about: aboutScreen,
      journal: journalScreen,
      faq: faqScreen,
      getintouch: getInTouchScreen,
      testimonials: testimonialsScreen,
      week: weekScreen,
      contact: contactScreen,
      policies: policiesList,
      policy: policyEditor,
      instagram: instagramScreen,
      photos: photosScreen,
      theme: themeScreen,
      signin: signInScreen,
    };
    const show = screens[name ?? ''] ?? dashboard;
    if (run === routing) await show(decodeURIComponent(arg ?? ''));
  } catch (err) {
    screen(
      'Problem',
      heading('Something went wrong'),
      h(
        'p',
        {},
        err instanceof SaveError ? err.message : 'This page could not be loaded. Please reload and try again.',
      ),
      h('a', { class: 'btn', href: '#/' }, 'Back to home'),
    );
    console.error(err);
  }
}

let lastHash = location.hash;
window.addEventListener('hashchange', () => {
  if (dirty && !confirm('You have changes that are not saved yet. Leave this page and lose them?')) {
    history.replaceState(null, '', lastHash);
    return;
  }
  setDirty(false);
  lastHash = location.hash;
  route();
});

const trackDirty = (form: HTMLElement) => {
  form.addEventListener('input', () => setDirty(true));
  form.addEventListener('change', () => setDirty(true));
};

// ---------- Posts: shared ----------

interface PostInfo {
  slug: string;
  data: Front;
  body: string;
}

async function loadPosts(): Promise<PostInfo[]> {
  const names = (await store!.list(PATHS.journal)).filter((n) => n.endsWith('.md'));
  const posts = await Promise.all(
    names.map(async (name) => {
      const text = (await store!.read(`${PATHS.journal}/${name}`)) ?? '';
      const { data, body } = parseDoc(text);
      return { slug: name.replace(/\.md$/, ''), data, body };
    }),
  );
  return posts.sort((a, b) => String(b.data.date ?? '').localeCompare(String(a.data.date ?? '')));
}

function postRow(p: PostInfo) {
  const draft = p.data.draft === true;
  const sub = [p.data.sample ? 'Sample' : '', p.data.topic, p.data.date ? formatDate(String(p.data.date)) : '']
    .filter(Boolean)
    .join(' · ');
  return h(
    'li',
    {},
    h(
      'a',
      { class: 'row', href: `#/post/${p.slug}` },
      h('span', { class: 'row-text' }, h('b', {}, String(p.data.title ?? p.slug)), h('span', { class: 'sub' }, sub)),
      h('span', { class: draft ? 'pill pill--draft' : 'pill pill--live' }, draft ? 'Draft' : 'Live'),
    ),
  );
}

// ---------- Dashboard ----------

const icons: Record<string, string> = {
  write: 'M4 20h4L19 9l-4-4L4 16v4z',
  price: 'M17 6.5A5 5 0 0 0 8 9v4H6m2 0v3a2 2 0 0 1-2 2h11M6 13h7',
  calendar: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M9 3v4M15 3v4',
  page: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7',
  quote: 'M5 18l-1 3 4-2h9a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v11z',
  photo: 'M4 6h16v12H4zM4 15l4-4 4 4 3-3 5 5M15 9.5h.01',
  palette:
    'M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-.9-.7-1.2-.7-2 0-.8.6-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-5-4-9-9-9zM7.5 12h.01M10 8h.01M15 8h.01',
};
const icon = (name: string) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', icons[name]);
  svg.append(path);
  return h('span', { class: 'ico' }, svg);
};

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Morning, Peter' : hour < 18 ? 'Afternoon, Peter' : 'Evening, Peter';
}

async function dashboard() {
  const [posts, insta] = await Promise.all([
    loadPosts(),
    readJson<{ updated: string | null; posts: unknown[] }>(PATHS.instagram),
  ]);
  const action = (href: string, ic: string, title: string, sub: string) =>
    h('a', { class: 'act', href }, icon(ic), h('b', {}, title), h('span', {}, sub));

  screen(
    'Home',
    heading(greeting(), 'What would you like to update today?'),
    h(
      'div',
      { class: 'acts' },
      action('#/website', 'page', 'Change your website', 'Any words, in any section'),
      action('#/post/new', 'write', 'Write a blog post', 'Training tips, race reports, club news'),
      action('#/prices', 'price', 'Change plans and prices', 'Coaching, PT and Run Club'),
      action('#/runclub', 'calendar', 'Run Club', 'Dates, details and what it says'),
      action('#/testimonials/new', 'quote', 'Add a testimonial', 'A client’s kind words'),
      action('#/photos', 'photo', 'Change photos', 'Home page, Run Club and Meet your coach'),
      action('#/theme', 'palette', 'Change colours', 'Pick a theme for your website'),
    ),
    h(
      'div',
      { class: 'two' },
      h(
        'section',
        { class: 'box box--posts', 'aria-labelledby': 'posts-h' },
        h(
          'div',
          { class: 'box-head' },
          h('h2', { id: 'posts-h' }, 'Your posts'),
          h('a', { href: '#/post/new' }, '+ New post'),
        ),
        posts.length
          ? h('ul', { class: 'rows' }, posts.slice(0, 6).map(postRow))
          : h('p', {}, 'No posts yet. Your first one is a click away.'),
        posts.length > 6 && h('a', { href: '#/posts' }, `See all ${posts.length} posts`),
      ),
      instagramBox(insta),
    ),
  );
}

function instagramBox(insta: { updated: string | null; posts: unknown[] }) {
  const connected = insta.posts.length > 0;
  return h(
    'section',
    { class: 'box', 'aria-labelledby': 'insta-h' },
    h('h2', { id: 'insta-h' }, 'Instagram feed'),
    h(
      'p',
      { class: 'status' },
      h('span', { class: connected ? 'dot dot--ok' : 'dot' }),
      h('b', {}, connected ? 'Connected to @peter_rothwell.pt' : 'Not connected yet'),
    ),
    h(
      'p',
      { class: 'muted' },
      connected
        ? `Your ${insta.posts.length} latest posts show on the home page${insta.updated ? `, last checked ${relativeTime(new Date(insta.updated))}` : ''}. New posts appear within an hour. Nothing to do here.`
        : 'Once Jack connects your Instagram account, your latest 6 posts will show on the home page automatically. Nothing to do here.',
    ),
  );
}

// ---------- Posts list ----------

async function postsList() {
  const posts = await loadPosts();
  screen(
    'Blog posts',
    heading('Blog posts', 'Write a new post, or tap one to edit it.'),
    h('p', {}, h('a', { class: 'btn btn--primary', href: '#/post/new' }, 'Write a blog post')),
    h(
      'section',
      { class: 'box' },
      posts.length ? h('ul', { class: 'rows' }, posts.map(postRow)) : h('p', {}, 'No posts yet.'),
    ),
  );
}

// ---------- Post editor ----------

const AUTOSAVE = 'rr-admin-autosave:';
const mdToRepo = (p: string) => `src/${p.replace(/^(\.\.\/)+/, '')}`;

/** A front matter date as YYYY-MM-DD, whether it was read as text or as a date. */
const isoDate = (value: unknown) =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10);

interface Draft {
  title: string;
  topic: string;
  excerpt: string;
  html: string;
  coverPath: string;
  coverData: string;
  coverAlt: string;
  /** Older autosaves have no date. */
  date?: string;
  savedAt: number;
}

async function postEditor(slugArg: string) {
  const isNew = slugArg === 'new' || !slugArg;
  const slug = isNew ? '' : slugArg;
  const posts = await loadPosts();
  const existing = posts.find((p) => p.slug === slug);
  if (!isNew && !existing) {
    screen(
      'Not found',
      heading('Post not found', undefined, ['#/posts', 'All posts']),
      h('p', {}, 'This post may have been deleted.'),
    );
    return;
  }
  const front: Front = { ...(existing?.data ?? {}) };
  const isLive = !!existing && front.draft !== true;
  const topics = [...new Set(posts.map((p) => String(p.data.topic ?? '')).filter(Boolean))];

  // State
  const autosaveKey = AUTOSAVE + (slug || 'new');
  let coverPath = String(front.cover ?? '');
  let coverData = '';

  // Fields
  const title = field('Title', textInput(String(front.title ?? ''), { maxlength: 120, class: 'big-input' }));
  const excerpt = field(
    'Short summary',
    textArea(String(front.excerpt ?? ''), { rows: 2, maxlength: 220 }),
    'One or two sentences. Shown under the title and in the list of posts.',
  );
  const topicInput = textInput(String(front.topic ?? ''), { list: 'topics', maxlength: 30 });
  const topic = field('Topic', topicInput, 'Pick one you used before, or type a new one.');
  // The date shown on the post. Today for a new post; an earlier date for posts
  // brought over from the old website, so they keep their original dates.
  const storedDate = isoDate(front.date);
  const postDate = field(
    'Date',
    h('input', { type: 'date', value: storedDate || today(), max: today() }),
    'Shown on the post. Change it to add an older post with its original date.',
  );
  const coverAlt = field(
    'Describe the photo',
    textInput(String(front.coverAlt ?? ''), { maxlength: 160 }),
    'For people who can’t see it, e.g. "Runners climbing a hill in the Pentlands".',
  );

  // Cover photo
  const coverImg = h('img', { alt: '' });
  const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', id: 'cover-file' });
  // One of Peter's photos from the library, or a new one from his device.
  const chooseCover = (async () => {
    const choice = await chooseFromLibrary();
    if (choice === 'upload') fileInput.click();
    else if (choice) takeCover(choice);
  }) as EventListener;
  const dropText = h(
    'div',
    { class: 'drop-text' },
    h(
      'b',
      {},
      'Drag a photo here, or ',
      h('button', { type: 'button', class: 'link', onclick: chooseCover }, 'choose a photo'),
    ),
    h('span', { class: 'hint' }, 'We resize it for you. Landscape photos work best.'),
  );
  const coverActions = h(
    'div',
    { class: 'cover-actions' },
    h('button', { type: 'button', class: 'btn btn--small', onclick: chooseCover }, 'Change photo'),
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn--small',
        onclick: (() => {
          coverPath = '';
          coverData = '';
          showCover();
          changed();
        }) as EventListener,
      },
      'Remove photo',
    ),
  );
  const drop = h('div', { class: 'drop', id: 'cover-drop' }, coverImg, dropText, fileInput);
  const coverError = h('p', { class: 'field-error', id: 'cover-file-error', hidden: true });

  async function showCover() {
    const src = coverData || (coverPath ? await store!.imageUrl(mdToRepo(coverPath)) : '');
    coverImg.src = src || '';
    coverImg.hidden = !src;
    dropText.hidden = !!src;
    coverActions.hidden = !src;
    coverAlt.wrap.hidden = !src;
  }
  async function takeCover(file?: File) {
    if (!file) return;
    coverError.hidden = true;
    try {
      coverData = await resizePhoto(file);
      showCover();
      changed();
    } catch (err) {
      coverError.textContent = (err as Error).message;
      coverError.hidden = false;
    }
  }
  fileInput.addEventListener('change', () => takeCover(fileInput.files?.[0]));
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('is-over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('is-over');
    takeCover(e.dataTransfer?.files[0]);
  });

  // Rich text editor (TipTap, see rich-editor.ts). Photos already in the post
  // get a URL the browser can show before the editor reads them.
  const startHtml = h('div');
  startHtml.innerHTML = markdownToHtml(existing?.body ?? '');
  await showBodyImages(startHtml);
  const bodyImageInput = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', id: 'body-photo' });
  const rich = createRichEditor({
    html: startHtml.innerHTML,
    attrs: {
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-labelledby': 'body-label',
      'aria-describedby': 'body-error',
      id: 'post-body',
    },
    onChange: () => changed(),
    onAddPhoto: () => bodyImageInput.click(),
    onError: (message) => toast(message, 'error'),
  });
  const editor = rich.dom;
  const bodyError = h('p', { class: 'field-error', id: 'body-error', hidden: true });

  bodyImageInput.addEventListener('change', async () => {
    const file = bodyImageInput.files?.[0];
    bodyImageInput.value = '';
    if (!file) return;
    try {
      const data = await resizePhoto(file);
      const alt = prompt('Describe the photo for people who can’t see it:') ?? '';
      const caption = prompt('Caption to show under the photo (optional):') ?? '';
      const name = `${slug || slugify(title.input.value) || 'post'}-${Date.now().toString(36)}.jpg`;
      rich.insertPhoto({
        src: data,
        alt: alt.trim(),
        title: caption.trim() || undefined,
        path: `../../assets/journal/${name}`,
      });
      changed();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  });
  const toolbar = rich.toolbar;

  // Autosave
  const autosaveNote = h('span', { class: 'autosave', 'aria-live': 'polite' });
  let autosaveTimer = 0;
  let autosavedAt = 0;
  const snapshot = (): Draft => ({
    title: title.input.value,
    topic: topic.input.value,
    excerpt: excerpt.input.value,
    html: rich.getHTML(),
    coverPath,
    coverData,
    coverAlt: coverAlt.input.value,
    date: postDate.input.value,
    savedAt: Date.now(),
  });
  function changed() {
    setDirty(true);
    clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
      const draft = snapshot();
      try {
        localStorage.setItem(autosaveKey, JSON.stringify(draft));
      } catch {
        // Photos can be too big for storage: keep the text at least.
        storage.set(
          autosaveKey,
          JSON.stringify({ ...draft, coverData: '', html: draft.html.replace(/src="data:[^"]*"/g, 'src=""') }),
        );
      }
      autosavedAt = draft.savedAt;
      updateAutosaveNote();
    }, 800);
  }
  const updateAutosaveNote = () => {
    if (autosavedAt) autosaveNote.textContent = `Draft saved automatically · ${relativeTime(new Date(autosavedAt))}`;
  };
  const noteTimer = window.setInterval(() => {
    if (!document.body.contains(autosaveNote)) clearInterval(noteTimer);
    else updateAutosaveNote();
  }, 30_000);
  [title, excerpt, topic, coverAlt, postDate].forEach((f) => f.input.addEventListener('input', changed));

  // Restore an autosaved draft
  let restoredNote: HTMLElement | null = null;
  const saved = storage.get(autosaveKey);
  if (saved) {
    try {
      const d = JSON.parse(saved) as Draft;
      title.input.value = d.title;
      topic.input.value = d.topic;
      excerpt.input.value = d.excerpt;
      rich.setHTML(d.html);
      coverPath = d.coverPath;
      coverData = d.coverData;
      coverAlt.input.value = d.coverAlt;
      if (d.date) postDate.input.value = d.date;
      autosavedAt = d.savedAt;
      updateAutosaveNote();
      setDirty(true);
      restoredNote = h(
        'div',
        { class: 'notice' },
        h('span', {}, `We brought back the changes you were making ${relativeTime(new Date(d.savedAt))}.`),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--small',
            onclick: (() => {
              storage.remove(autosaveKey);
              setDirty(false);
              route();
            }) as EventListener,
          },
          isNew ? 'Start again' : 'Discard changes',
        ),
      );
    } catch {
      storage.remove(autosaveKey);
    }
  }
  await showCover();

  // Validation and saving
  const summary = errorSummary();
  function validate(publishing: boolean) {
    const errors = new Errors(summary);
    if (!title.input.value.trim()) errors.add(title, 'Give your post a title.');
    if (!postDate.input.value) errors.add(postDate, 'Choose the date for your post.');
    else if (postDate.input.value > today())
      errors.add(postDate, 'That date is in the future. Choose today or earlier.');
    if (publishing) {
      if (!excerpt.input.value.trim()) errors.add(excerpt, 'Write a short summary (one or two sentences).');
      if (!topic.input.value.trim()) errors.add(topic, 'Choose a topic, for example "Strength".');
      if (wordCount(htmlToMarkdown(rich.getHTML())) < 20) {
        errors.add(editor, 'Your post needs at least a couple of sentences before it can go live.');
      }
    }
    if ((coverPath || coverData) && !coverAlt.input.value.trim())
      errors.add(coverAlt, 'Describe the cover photo in a few words.');
    if (editor.querySelector('img:not([alt]), img[alt=""]')) {
      errors.add(
        editor,
        'One of the photos in your post has no description. Delete it and add it again with a description.',
      );
    }
    const ok = errors.show();
    const bodyProblem = errors.messageFor(editor);
    if (bodyProblem) {
      bodyError.textContent = bodyProblem;
      bodyError.hidden = false;
    }
    return ok;
  }

  async function submit(draft: boolean, button: HTMLButtonElement) {
    if (!validate(!draft)) return;
    const finalSlug = slug || uniqueSlug(slugify(title.input.value) || 'post', posts);
    const changes: Change[] = [];
    if (coverData) {
      const name = `${finalSlug}-cover-${Date.now().toString(36)}.jpg`;
      coverPath = `../../assets/journal/${name}`;
      changes.push({ path: `${PATHS.journalImages}/${name}`, image: coverData });
    }
    for (const img of editor.querySelectorAll<HTMLImageElement>('img[data-path]')) {
      if (img.src.startsWith('data:')) changes.push({ path: mdToRepo(img.dataset.path!), image: img.src });
    }
    const data: Front = {
      title: title.input.value.trim(),
      date: postDate.input.value || today(),
      topic: topic.input.value.trim(),
      excerpt: excerpt.input.value.trim(),
      cover: coverPath,
      coverAlt: coverPath ? coverAlt.input.value.trim() : '',
      draft: draft || '',
      sample: front.sample === true || '',
    };
    // A draft published for the first time gets today's date, unless a date was chosen for it.
    if (!draft && front.draft === true && postDate.input.value === storedDate) data.date = today();
    changes.push({
      path: `${PATHS.journal}/${finalSlug}.md`,
      text: stringifyDoc(data, htmlToMarkdown(rich.getHTML())),
    });

    const verb = draft ? 'Save draft' : isLive ? 'Update post' : 'Publish post';
    if (!(await save(changes, `${verb}: ${data.title}`, button))) return;
    coverData = '';
    storage.remove(autosaveKey);

    if (draft) {
      toast(
        isDemo()
          ? 'Draft saved in this demo. It isn’t on the website.'
          : 'Draft saved. It isn’t on the website until you publish it.',
      );
      location.hash = `#/post/${finalSlug}`;
      if (finalSlug === slug) route();
      return;
    }
    const answer = await dialog(
      isDemo() ? 'Published (demo)' : isLive ? 'Post updated' : 'Post published',
      isDemo()
        ? [
            h('p', {}, 'Your post would appear on the site in about a minute.'),
            h('p', { class: 'muted' }, 'This is the demo, so nothing has changed on the real website.'),
          ]
        : [h('p', {}, 'Your post will appear on the site in about a minute.')],
      [
        { label: 'Preview the post', value: 'preview' },
        isDemo()
          ? { label: 'Back to home', value: 'home', primary: true }
          : { label: 'View on website', value: 'site', primary: true },
      ],
    );
    if (answer === 'preview') {
      location.hash = `#/post/${finalSlug}`;
      await waitForRoute();
      document.getElementById('preview-btn')?.click();
    } else if (answer === 'site') {
      window.open(`${config.siteUrl}journal/${finalSlug}/`, '_blank', 'noopener');
      location.hash = '#/';
    } else location.hash = '#/';
  }

  const form = h(
    'form',
    { class: 'cols', novalidate: true, onsubmit: ((e: Event) => e.preventDefault()) as EventListener },
    h(
      'section',
      { class: 'box editor', 'aria-label': 'Post editor' },
      title.wrap,
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Cover photo'), drop, coverActions, coverError),
      coverAlt.wrap,
      h(
        'div',
        { class: 'field' },
        h('span', { class: 'label', id: 'body-label' }, 'Your post'),
        toolbar,
        editor,
        bodyImageInput,
        bodyError,
      ),
    ),
    h(
      'aside',
      { class: 'panel', 'aria-label': 'Publishing' },
      h(
        'div',
        { class: 'box' },
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--primary btn--big',
            onclick: ((e: Event) => submit(false, e.currentTarget as HTMLButtonElement)) as EventListener,
          },
          isLive ? 'Update post' : 'Publish now',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--big',
            onclick: ((e: Event) => submit(true, e.currentTarget as HTMLButtonElement)) as EventListener,
          },
          isLive ? 'Move back to drafts' : 'Save as draft',
        ),
        h(
          'button',
          { type: 'button', class: 'btn btn--big', id: 'preview-btn', onclick: (() => previewPost()) as EventListener },
          'Preview',
        ),
        h(
          'p',
          { class: 'hint' },
          isLive
            ? 'This post is live on your website. Changes go live when you press Update.'
            : 'Publishing puts it on your website. You can edit it or move it back to drafts later.',
        ),
      ),
      h(
        'div',
        { class: 'box' },
        topic.wrap,
        postDate.wrap,
        excerpt.wrap,
        h(
          'datalist',
          { id: 'topics' },
          topics.map((t) => h('option', { value: t })),
        ),
      ),
      !isNew &&
        h(
          'div',
          { class: 'box' },
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn--danger',
              onclick: (async (e: Event) => {
                const answer = await dialog(
                  'Delete this post?',
                  [h('p', {}, `"${front.title}" will be removed from your website. This can’t be undone here.`)],
                  [
                    { label: 'Keep it', value: '' },
                    { label: 'Delete post', value: 'delete', primary: true },
                  ],
                );
                if (answer !== 'delete') return;
                if (
                  await save(
                    [{ path: `${PATHS.journal}/${slug}.md`, remove: true }],
                    `Delete post: ${front.title}`,
                    e.currentTarget as HTMLButtonElement,
                  )
                ) {
                  storage.remove(autosaveKey);
                  toast(
                    isDemo()
                      ? 'Post deleted in this demo.'
                      : 'Post deleted. It will disappear from your website in about a minute.',
                  );
                  location.hash = '#/posts';
                }
              }) as EventListener,
            },
            'Delete post',
          ),
        ),
    ),
  );

  function previewPost() {
    const dlg = h(
      'dialog',
      { class: 'preview', 'aria-label': 'Preview of your post' },
      h(
        'div',
        { class: 'preview-bar' },
        h('span', {}, 'Preview: this is how your post will look'),
        h(
          'button',
          { type: 'button', class: 'btn btn--small', onclick: (() => dlg.close()) as EventListener },
          'Close preview',
        ),
      ),
      h(
        'article',
        { class: 'site-post' },
        h('p', { class: 'mono' }, `${topic.input.value || 'Topic'} · ${formatDate(postDate.input.value || today())}`),
        h('h1', { class: 'display' }, title.input.value || 'Your title'),
        h('p', { class: 'excerpt' }, excerpt.input.value),
        coverImg.src && !coverImg.hidden && h('img', { class: 'cover', src: coverImg.src, alt: coverAlt.input.value }),
        (() => {
          const body = h('div', { class: 'body' });
          body.innerHTML = rich.getHTML();
          return body;
        })(),
      ),
    );
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
  }

  trackDirty(form);
  setDirty(!!restoredNote);
  screen(
    isNew ? 'Write a new post' : `Edit: ${front.title}`,
    h(
      'div',
      { class: 'page-head page-head--row' },
      h('div', {}, backLink('#/posts', 'All posts'), h('h1', {}, isNew ? 'Write a new post' : 'Edit post')),
      autosaveNote,
    ),
    restoredNote,
    summary,
    form,
  );
}

function uniqueSlug(base: string, posts: PostInfo[]) {
  const taken = new Set(posts.map((p) => p.slug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  return slug;
}

/** Swap repo image paths in the editor for URLs the browser can show. */
async function showBodyImages(root: HTMLElement) {
  for (const img of root.querySelectorAll('img')) {
    const src = img.getAttribute('src') ?? '';
    if (src.startsWith('http') || src.startsWith('data:')) continue;
    img.dataset.path = src;
    img.src = (await store!.imageUrl(mdToRepo(src))) ?? '';
  }
}

function waitForRoute() {
  return new Promise((r) => setTimeout(r, 400));
}

// ---------- Your website: every section, in page order ----------

type Site = Record<string, unknown>;
/** Part of a section form: a box of fields that checks itself and writes into site.json. */
interface Part {
  box: HTMLElement;
  check(errors: Errors): void;
  apply(site: Site): Site;
}

// The public site's home page, worked out from where the editor is (…/admin/).
const siteRoot = new URL('../', location.href.split('#')[0]).href;

const SECTIONS: { route: string; title: string; sub: string }[] = [
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

function websiteScreen() {
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
function sectionHeading(title: string, intro: string, anchor?: string) {
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
const infoBox = (title: string, text: string, links: [string, string][]) =>
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
async function sectionScreen(o: {
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

const menuScreen = () =>
  sectionScreen({
    title: 'Menu and footer',
    intro: 'The links at the top of every page, the main button, and the bottom of every page.',
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

const heroScreen = () =>
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
      infoBox('Photos', 'The photos beside the headline are changed in Photos.', [['Change photos', '#/photos']]),
    ],
  });

const aboutScreen = () =>
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
function statsPart(site: Site): Part {
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

const journalScreen = () =>
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

const getInTouchScreen = () =>
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

// ---------- Ways to train (plans and prices) ----------

const MAX_PLANS = 4;

async function pricesScreen() {
  const [services, site, testimonials] = await Promise.all([
    readJson<Service[]>(PATHS.services),
    readJson<Site>(PATHS.site),
    readJson<Testimonial[]>(PATHS.testimonials),
  ]);
  const summary = errorSummary();
  const list = h('div', { class: 'stack' });

  type Row = { s: Service; name: Field; label: Field; price: Field; per: Field; points: Field; box: HTMLElement };
  let rows: Row[] = [];
  const makeRow = (s: Service): Row => {
    const name = field('Name', textInput(s.name, { maxlength: 40 }));
    const label = field(
      'Small label above the name',
      textInput(s.label, { maxlength: 40 }),
      'e.g. "Online" or "Group · Weekly"',
    );
    const price = field(
      'Price (£)',
      textInput(s.price.replace(/^£/, ''), { inputmode: 'decimal', maxlength: 8, class: 'price-input' }),
    );
    const per = field('Per', textInput(s.per.replace(/^\/\s*/, ''), { maxlength: 20 }), 'e.g. "month" or "8 weeks"');
    const points = field(
      'What’s included',
      textArea(s.points.join('\n'), { rows: 4 }),
      'One point per line. Three or four short points work best.',
    );
    const isClub = s.id === 'runclub';
    const row: Row = { s, name, label, price, per, points, box: h('fieldset', { class: 'box' }) };
    row.box.append(
      h('legend', {}, s.name || 'New plan'),
      isClub ? h('p', { class: 'hint' }, 'This plan is linked to your Run Club section, so it can’t be removed.') : '',
      name.wrap,
      label.wrap,
      h('div', { class: 'pair' }, price.wrap, per.wrap),
      points.wrap,
      h(
        'div',
        { class: 'row-actions' },
        h(
          'button',
          { type: 'button', class: 'btn btn--small', onclick: (() => move(row, -1)) as EventListener },
          'Move left',
        ),
        h(
          'button',
          { type: 'button', class: 'btn btn--small', onclick: (() => move(row, 1)) as EventListener },
          'Move right',
        ),
        !isClub &&
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn--small btn--danger',
              onclick: (async () => {
                const answer = await dialog(
                  `Remove ${row.name.input.value.trim() || 'this plan'}?`,
                  [h('p', {}, 'It comes off your website when you press Save. You can add it again later.')],
                  [
                    { label: 'Keep it', value: '' },
                    { label: 'Remove plan', value: 'remove', primary: true },
                  ],
                );
                if (answer !== 'remove') return;
                rows = rows.filter((r) => r !== row);
                draw();
                setDirty(true);
              }) as EventListener,
            },
            'Remove plan',
          ),
      ),
    );
    return row;
  };
  const move = (row: Row, by: number) => {
    const i = rows.indexOf(row);
    const j = i + by;
    if (j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    draw();
    setDirty(true);
  };
  const addBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn',
      onclick: (() => {
        const row = makeRow({ id: '', label: '', name: '', price: '', per: 'month', points: [] });
        rows.push(row);
        draw();
        setDirty(true);
        row.name.input.focus();
      }) as EventListener,
    },
    '+ Add a plan',
  );
  const draw = () => {
    list.replaceChildren(...rows.map((r) => r.box));
    addBtn.hidden = rows.length >= MAX_PLANS;
  };
  rows = services.map(makeRow);
  draw();

  const heads = textGroup(site, 'Heading', [
    { path: 'coaching.title', label: 'Heading', max: 40 },
    { path: 'coaching.intro', label: 'Introduction', kind: 'text', max: 250 },
  ]);
  const extras = textGroup(site, 'Under the plans', [
    {
      path: 'coaching.enquire',
      label: 'Button on each plan',
      max: 20,
      hint: 'It goes to the enquiry form, with that plan picked.',
    },
    {
      path: 'coaching.more',
      label: 'Second button on the Run Club plan',
      max: 14,
      hint: 'One word works best, e.g. “Details”. It goes to the Run Club section.',
    },
    {
      path: 'coaching.inPersonLabel',
      label: 'Label above your address',
      max: 30,
      hint: 'Your address and map come from Contact details.',
    },
    { path: 'coaching.onlineLabel', label: 'Label for online training', max: 30 },
    { path: 'coaching.onlineTitle', label: 'Online heading', max: 30 },
    { path: 'coaching.onlineText', label: 'Online text', kind: 'text', max: 160 },
  ]);

  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save changes');
  const lines = (f: Field) =>
    f.input.value
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean);
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        heads.check(errors);
        if (!rows.length) errors.add(addBtn, 'Add at least one plan.');
        const names = new Set<string>();
        rows.forEach((r, i) => {
          const n = r.name.input.value.trim();
          const who = n || `Plan ${i + 1}`;
          if (!n) errors.add(r.name, `Plan ${i + 1}: give it a name.`);
          else if (names.has(n.toLowerCase())) errors.add(r.name, `${n}: two plans have this name. Give each its own.`);
          names.add(n.toLowerCase());
          if (!/^\d+(\.\d{1,2})?$/.test(r.price.input.value.trim()))
            errors.add(r.price, `${who}: the price should be a number, like 80 or 79.50.`);
          if (!r.per.input.value.trim()) errors.add(r.per, `${who}: say what the price is per, like "month".`);
          const pts = lines(r.points);
          if (pts.length === 0) errors.add(r.points, `${who}: add at least one thing that’s included.`);
          else if (pts.length > 6) errors.add(r.points, `${who}: keep it to 6 points or fewer so the cards stay tidy.`);
          else if (pts.some((p) => p.length > 70)) errors.add(r.points, `${who}: keep each point under 70 characters.`);
        });
        extras.check(errors);
        if (!errors.show()) return;

        // New plans get an id from their name (used for links); existing ones keep theirs.
        const ids = new Set(rows.map((r) => r.s.id).filter(Boolean));
        const next: Service[] = rows.map((r) => {
          let id = r.s.id;
          if (!id) {
            const base = slugify(r.name.input.value) || 'plan';
            id = base;
            for (let n = 2; ids.has(id) || id === 'runclub'; n++) id = `${base}-${n}`;
            ids.add(id);
          }
          return {
            ...r.s,
            id,
            label: r.label.input.value.trim(),
            name: r.name.input.value.trim(),
            price: `£${r.price.input.value.trim()}`,
            per: `/ ${r.per.input.value.trim()}`,
            points: lines(r.points),
          };
        });
        const changes: Change[] = [
          { path: PATHS.services, text: toJson(next) },
          { path: PATHS.site, text: toJson(extras.apply(heads.apply(site))) },
        ];
        // A renamed plan: reviews that named it follow the new name.
        const renamed = new Map(
          services.flatMap((old) => {
            const now = next.find((s) => s.id === old.id);
            return now && now.name !== old.name ? [[old.name, now.name] as const] : [];
          }),
        );
        if (renamed.size && testimonials.some((t) => renamed.has(t.service))) {
          const updated = testimonials.map((t) => ({ ...t, service: renamed.get(t.service) ?? t.service }));
          changes.push({ path: PATHS.testimonials, text: toJson(updated) });
        }
        if (await save(changes, 'Update Ways to train', saveBtn)) {
          toast(savedMessage());
          route();
        }
      }) as EventListener,
    },
    heads.box,
    h('h2', {}, 'Your plans'),
    h('p', { class: 'hint' }, `Up to ${MAX_PLANS} plans, shown side by side in this order.`),
    list,
    addBtn,
    extras.box,
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    'Ways to train',
    sectionHeading('Ways to train', 'Your plans and prices, and where you train people.', '#coaching'),
    summary,
    form,
  );
}

// ---------- Run Club ----------

interface RunClub {
  eyebrow: string;
  headline: string;
  paragraphs: string[];
  facts: { label: string; value: string; note: string }[];
  button: string;
  photos?: SitePhoto[];
}

async function runClubScreen() {
  const [services, site] = await Promise.all([
    readJson<Service[]>(PATHS.services),
    readJson<{ runClub?: RunClub } & Site>(PATHS.site),
  ]);
  const plan = services.find((s) => s.id === 'runclub');
  if (!plan || !site.runClub) {
    screen('Run Club', heading('Run Club'), h('p', {}, 'The Run Club is missing from your website’s files.'));
    return;
  }
  const club = site.runClub;
  const sched = plan.schedule ?? { starts: '', when: '', spaces: '' };
  const summary = errorSummary();

  const words = textGroup(site, 'What it says', [
    { path: 'runClub.eyebrow', label: 'Small heading', max: 40 },
    { path: 'runClub.headline', label: 'Big heading', max: 50, hint: 'e.g. “Run together. Get faster.”' },
    {
      path: 'runClub.paragraphs',
      label: 'About the Run Club',
      kind: 'paras',
      most: 4,
      max: 600,
      hint: 'Leave an empty line between paragraphs. Two short paragraphs work best.',
    },
    { path: 'runClub.button', label: 'Button', max: 26, hint: 'It goes to the enquiry form, with Run Club picked.' },
  ]);

  // The four boxes of key facts.
  const facts = [0, 1, 2, 3].map((i) => {
    const f = (club.facts ?? [])[i] ?? { label: '', value: '', note: '' };
    const label = field('Small label', textInput(f.label, { maxlength: 24 }));
    const value = field('Big text', textInput(f.value, { maxlength: 16 }), 'Short, e.g. “8 sessions”.');
    const note = field('Line underneath', textInput(f.note, { maxlength: 40 }));
    return {
      label,
      value,
      note,
      box: h('fieldset', { class: 'box' }, h('legend', {}, `Box ${i + 1}`), label.wrap, value.wrap, note.wrap),
    };
  });

  const starts = field('Next block starts (optional)', h('input', { type: 'date', value: sched.starts }));
  const when = field(
    'Day and time',
    textInput(sched.when || 'Thursdays, 6pm', { maxlength: 40 }),
    'Shown with the date on the Run Club plan card, e.g. “Thursdays, 6pm”.',
  );
  const spaces = field(
    'Spaces left (optional)',
    textInput(sched.spaces, { inputmode: 'numeric', maxlength: 3 }),
    'Leave empty to hide it.',
  );
  const clearDates = h(
    'button',
    {
      type: 'button',
      class: 'btn btn--small',
      onclick: (() => {
        (starts.input as HTMLInputElement).value = '';
        spaces.input.value = '';
        setDirty(true);
      }) as EventListener,
    },
    'Clear dates',
  );
  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save changes');

  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        words.check(errors);
        facts.forEach((f, i) => {
          const any = [f.label, f.value, f.note].some((x) => x.input.value.trim());
          if (any && !f.value.input.value.trim())
            errors.add(f.value, `Box ${i + 1}: add the big text, or clear the box.`);
        });
        if (!facts.some((f) => f.value.input.value.trim())) errors.add(facts[0].value, 'Fill in at least one box.');
        const date = (starts.input as HTMLInputElement).value;
        if (date && date < today())
          errors.add(starts, 'That date has passed. Choose the next block’s start date, or press Clear dates.');
        if (date && !when.input.value.trim()) errors.add(when, 'Say which day and time, e.g. “Thursdays, 6pm”.');
        if (spaces.input.value.trim() && !/^\d{1,3}$/.test(spaces.input.value.trim()))
          errors.add(spaces, 'Spaces left should be a number, like 6. Or leave it empty.');
        if (!errors.show()) return;

        const schedule = date
          ? { starts: date, when: when.input.value.trim(), spaces: spaces.input.value.trim() }
          : undefined;
        const nextServices = services.map((s) => (s.id === 'runclub' ? { ...s, schedule } : s));
        const nextFacts = facts.map((f) => ({
          label: f.label.input.value.trim(),
          value: f.value.input.value.trim(),
          note: f.note.input.value.trim(),
        }));
        const nextSite = setPath(words.apply(site), 'runClub.facts', nextFacts);
        const changes: Change[] = [
          { path: PATHS.site, text: toJson(nextSite) },
          { path: PATHS.services, text: toJson(nextServices) },
        ];
        if (await save(changes, 'Update Run Club', saveBtn)) toast(savedMessage());
      }) as EventListener,
    },
    words.box,
    h('h2', {}, 'Key facts'),
    h(
      'p',
      { class: 'hint' },
      'Four boxes beside the photos, e.g. “The block / 8 sessions / over 8 weeks”. Leave a box empty to hide it.',
    ),
    h(
      'div',
      { class: 'days' },
      facts.map((f) => f.box),
    ),
    h(
      'fieldset',
      { class: 'box' },
      h('legend', {}, 'Next block'),
      h(
        'p',
        { class: 'hint' },
        'Shown under the price, and on the Run Club plan card. Leave the date empty to hide it.',
      ),
      starts.wrap,
      when.wrap,
      spaces.wrap,
      h('div', { class: 'row-actions' }, clearDates),
    ),
    infoBox(
      'Photos and price',
      `The photos (${club.photos?.length ?? 0} at the moment) are changed in Photos. ` +
        `The price, ${plan.price} ${plan.per}, is changed in Ways to train.`,
      [
        ['Change Run Club photos', '#/photos/runclub'],
        ['Change the price', '#/prices'],
      ],
    ),
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    'Run Club',
    sectionHeading(
      'Run Club',
      'The Run Club section of your home page, and the dates on the Run Club card.',
      '#runclub',
    ),
    summary,
    form,
  );
}

// ---------- Questions (FAQ) ----------

interface Faq {
  question: string;
  answer: string;
}
const MAX_FAQS = 12;
// Notes still to fill in are saved as <mark>[Peter to confirm: …]</mark>. In the
// editor they show as plain [Peter to confirm: …] so they're easy to read and replace.
const fromMarks = (s: string) => s.replace(/<mark>([\s\S]*?)<\/mark>/g, '$1');
const toMarks = (s: string) => s.replace(/\[Peter to confirm:[^\]]*\]/g, (m) => `<mark>${m}</mark>`);

async function faqScreen() {
  const [items, site] = await Promise.all([readJson<Faq[]>(PATHS.faq), readJson<Site>(PATHS.site)]);
  const summary = errorSummary();
  const heads = textGroup(site, 'Heading', [
    { path: 'faq.eyebrow', label: 'Small heading', max: 40 },
    { path: 'faq.title', label: 'Big heading', max: 30, hint: 'Also used for the link at the bottom of every page.' },
  ]);
  const list = h('div', { class: 'stack' });
  type Row = { question: Field; answer: Field; box: HTMLElement };
  let rows: Row[] = [];
  const makeRow = (f: Faq): Row => {
    const question = field('Question', textInput(f.question, { maxlength: 120 }));
    const todo = /\[Peter to confirm:/.test(fromMarks(f.answer));
    const answer = field(
      'Your answer',
      textArea(fromMarks(f.answer), { rows: 4, maxlength: 800 }),
      todo ? 'Replace the part in [square brackets] with your answer.' : undefined,
    );
    const row: Row = { question, answer, box: h('fieldset', { class: 'box' }) };
    row.box.append(
      h('legend', {}, 'Question'),
      question.wrap,
      answer.wrap,
      h(
        'div',
        { class: 'row-actions' },
        h(
          'button',
          { type: 'button', class: 'btn btn--small', onclick: (() => move(row, -1)) as EventListener },
          'Move up',
        ),
        h(
          'button',
          { type: 'button', class: 'btn btn--small', onclick: (() => move(row, 1)) as EventListener },
          'Move down',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--small btn--danger',
            onclick: (() => {
              rows = rows.filter((r) => r !== row);
              draw();
              setDirty(true);
            }) as EventListener,
          },
          'Remove',
        ),
      ),
    );
    return row;
  };
  const move = (row: Row, by: number) => {
    const i = rows.indexOf(row);
    const j = i + by;
    if (j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    draw();
    setDirty(true);
  };
  const addBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn',
      onclick: (() => {
        const row = makeRow({ question: '', answer: '' });
        rows.push(row);
        draw();
        setDirty(true);
        row.question.input.focus();
      }) as EventListener,
    },
    '+ Add a question',
  );
  const draw = () => {
    list.replaceChildren(...(rows.length ? rows.map((r) => r.box) : [h('p', {}, 'No questions yet.')]));
    rows.forEach((r, i) => (r.box.querySelector('legend')!.textContent = `Question ${i + 1}`));
    addBtn.hidden = rows.length >= MAX_FAQS;
  };
  rows = items.map(makeRow);
  draw();

  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save changes');
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        heads.check(errors);
        rows.forEach((r, i) => {
          if (!r.question.input.value.trim()) errors.add(r.question, `Question ${i + 1}: write the question.`);
          if (!r.answer.input.value.trim()) errors.add(r.answer, `Question ${i + 1}: write your answer.`);
        });
        if (!errors.show()) return;
        const next: Faq[] = rows.map((r) => ({
          question: r.question.input.value.trim(),
          answer: toMarks(r.answer.input.value.replace(/\s+/g, ' ').trim()),
        }));
        const changes: Change[] = [
          { path: PATHS.faq, text: toJson(next) },
          { path: PATHS.site, text: toJson(heads.apply(site)) },
        ];
        if (await save(changes, 'Update questions', saveBtn)) toast(savedMessage());
      }) as EventListener,
    },
    heads.box,
    h('h2', {}, 'Questions and answers'),
    h('p', { class: 'hint' }, 'People tap a question to see your answer. They show in this order.'),
    list,
    addBtn,
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    'Questions',
    sectionHeading('Questions', 'Common questions near the bottom of your home page, with your answers.', '#faq'),
    summary,
    form,
  );
}

// ---------- Testimonials ----------

async function testimonialsScreen(arg: string) {
  const [items, services, site] = await Promise.all([
    readJson<Testimonial[]>(PATHS.testimonials),
    readJson<Service[]>(PATHS.services),
    readJson<Site>(PATHS.site),
  ]);
  const summary = errorSummary();
  const heads = textGroup(site, 'Heading', [
    { path: 'reviews.eyebrow', label: 'Small heading', max: 40 },
    {
      path: 'reviews.title',
      label: 'Big heading',
      max: 30,
      hint: 'Also used for the link at the bottom of every page.',
    },
  ]);
  const list = h('div', { class: 'stack' });
  type Row = {
    name: Field;
    service: Field;
    quote: Field;
    started: Field;
    ongoing: HTMLInputElement;
    ended: Field;
    consent: HTMLInputElement;
    consentWrap: HTMLElement;
    box: HTMLElement;
  };
  let rows: Row[] = [];

  const makeRow = (t: Testimonial, isNew = false): Row => {
    const name = field('Client’s first name', textInput(t.name, { maxlength: 40, autocomplete: 'off' }));
    const select = h(
      'select',
      {},
      h('option', { value: '' }, 'Choose one'),
      [...services.map((s) => s.name), 'Online coaching', 'Personal training', 'Run Club']
        .filter((v, i, a) => a.indexOf(v) === i)
        .map((n) => h('option', { value: n }, n)),
    );
    if (t.service && ![...select.options].some((o) => o.value === t.service))
      select.append(h('option', { value: t.service }, t.service));
    select.value = t.service;
    const service = field('What they did with you', select);
    const quote = field(
      'What they said',
      textArea(t.quote, { rows: 4, maxlength: 600 }),
      'Paste their words exactly as they wrote them.',
    );
    // How long they've trained together: shown on the site as "Client for 4 months".
    const started = field(
      'Started training with you (optional)',
      h('input', { type: 'date', value: t.started ?? '', max: today() }),
      'Shows how long they’ve been your client, e.g. “Client for 4 months”. Leave blank to hide it.',
    );
    const ongoing = h('input', {
      type: 'checkbox',
      id: `ongoing-${Math.random().toString(36).slice(2)}`,
      checked: !t.ended || t.ended === 'ongoing',
    });
    const ended = field(
      'Finished on',
      h('input', { type: 'date', value: t.ended && t.ended !== 'ongoing' ? t.ended : '', max: today() }),
    );
    const showEnded = () => {
      ended.wrap.hidden = ongoing.checked;
    };
    ongoing.addEventListener('change', showEnded);
    showEnded();
    const consent = h('input', {
      type: 'checkbox',
      id: `consent-${Math.random().toString(36).slice(2)}`,
      checked: !!t.consent,
    });
    const consentWrap = h(
      'label',
      { class: 'check', for: consent.id },
      consent,
      h('span', {}, 'Client agreed to this being published'),
    );
    const box: HTMLElement = h(
      'fieldset',
      { class: 'box' },
      h('legend', {}, isNew ? 'New testimonial' : t.name || 'Testimonial'),
      name.wrap,
      service.wrap,
      quote.wrap,
      started.wrap,
      h(
        'label',
        { class: 'check', for: ongoing.id },
        ongoing,
        h('span', {}, 'Still training with me (the time keeps counting up by itself)'),
      ),
      ended.wrap,
      consentWrap,
      h(
        'div',
        { class: 'row-actions' },
        h(
          'button',
          { type: 'button', class: 'btn btn--small', onclick: (() => move(row, -1)) as EventListener },
          'Move up',
        ),
        h(
          'button',
          { type: 'button', class: 'btn btn--small', onclick: (() => move(row, 1)) as EventListener },
          'Move down',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--small btn--danger',
            onclick: (() => {
              rows = rows.filter((r) => r !== row);
              draw();
              setDirty(true);
            }) as EventListener,
          },
          'Remove',
        ),
      ),
    );
    const row = { name, service, quote, started, ongoing, ended, consent, consentWrap, box };
    return row;
  };
  const move = (row: Row, by: number) => {
    const i = rows.indexOf(row);
    const j = i + by;
    if (j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    draw();
    setDirty(true);
    row.box.querySelector('button')?.focus();
  };
  const draw = () =>
    list.replaceChildren(...(rows.length ? rows.map((r) => r.box) : [h('p', {}, 'No testimonials yet.')]));

  rows = items.map((t) => makeRow(t));
  draw();
  const addRow = () => {
    const row = makeRow({ name: '', service: '', quote: '' }, true);
    rows.push(row);
    draw();
    row.box.scrollIntoView({ block: 'center' });
    row.name.input.focus();
  };

  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save changes');
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        heads.check(errors);
        rows.forEach((r, i) => {
          const who = r.name.input.value.trim() || `Testimonial ${i + 1}`;
          if (!r.name.input.value.trim()) errors.add(r.name, `Testimonial ${i + 1}: add the client’s first name.`);
          if (!r.service.input.value) errors.add(r.service, `${who}: choose what they did with you.`);
          if (r.quote.input.value.trim().length < 20)
            errors.add(r.quote, `${who}: paste what they said (at least a sentence).`);
          const start = r.started.input.value;
          const end = r.ended.input.value;
          if (start > today()) errors.add(r.started, `${who}: the start date is in the future.`);
          if (start && !r.ongoing.checked) {
            if (!end) errors.add(r.ended, `${who}: choose when they finished, or tick “Still training with me”.`);
            else if (end <= start) errors.add(r.ended, `${who}: the finish date must be after the start date.`);
            else if (end > today())
              errors.add(r.ended, `${who}: the finish date is in the future. Tick “Still training with me” instead.`);
          }
          if (!r.consent.checked)
            errors.add(r.consent, `${who}: tick the box to confirm they agreed to it being published.`);
        });
        if (!errors.show()) return;
        const next: Testimonial[] = rows.map((r) => ({
          name: r.name.input.value.trim(),
          service: r.service.input.value,
          quote: r.quote.input.value.trim(),
          consent: true,
          ...(r.started.input.value && {
            started: r.started.input.value,
            ended: r.ongoing.checked ? 'ongoing' : r.ended.input.value,
          }),
        }));
        const changes: Change[] = [
          { path: PATHS.testimonials, text: toJson(next) },
          { path: PATHS.site, text: toJson(heads.apply(site)) },
        ];
        if (await save(changes, 'Update reviews', saveBtn)) {
          toast(savedMessage());
          history.replaceState(null, '', '#/testimonials');
          lastHash = location.hash;
          route();
        }
      }) as EventListener,
    },
    heads.box,
    h('h2', {}, 'Reviews'),
    list,
    h(
      'div',
      { class: 'save-bar' },
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn--big',
          onclick: (() => addRow()) as EventListener,
        },
        '+ Add a testimonial',
      ),
      saveBtn,
    ),
  );
  trackDirty(form);
  screen(
    'Reviews',
    sectionHeading(
      'Reviews',
      'Kind words from clients, shown on your home page. Only add ones the client has agreed to share.',
      '#reviews',
    ),
    summary,
    form,
  );
  if (arg === 'new') addRow();
}

// ---------- Photos (hero carousel, Run Club and Meet your coach) ----------

interface SitePhoto {
  image: string;
  alt: string;
}
const MAX_CAROUSEL_PHOTOS = 6;
const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Peter's photo library (src/assets/library): full-size photos to pick from for
 * any photo spot. Resolves with the chosen photo, 'upload' to choose one from his
 * device instead (straight away if the library is empty), or null if cancelled.
 */
async function chooseFromLibrary(): Promise<File | 'upload' | null> {
  let names: string[] = [];
  try {
    names = (await store!.list(PATHS.library)).filter((n) => /\.(jpe?g|png|webp)$/i.test(n)).sort();
  } catch {
    /* can't read the library: uploading still works */
  }
  if (!names.length) return 'upload';

  const label = (name: string) => name.replace(/\.[^.]*$/, '').replace(/-/g, ' ');
  let chosen = '';
  const dlg = h(
    'dialog',
    { class: 'dlg dlg--library', 'aria-labelledby': 'library-title' },
    h('h2', { id: 'library-title' }, 'Choose a photo'),
    h('p', {}, 'Pick one of your photos, or upload a new one from your phone or computer.'),
    h(
      'div',
      { class: 'library-grid' },
      names.map((name) => {
        const img = h('img', { alt: '', loading: 'lazy' });
        store!.imageUrl(`${PATHS.library}/${name}`).then((url) => (img.src = url ?? ''));
        return h(
          'button',
          {
            type: 'button',
            class: 'library-pick',
            'aria-label': `Use ${label(name)}`,
            title: label(name),
            onclick: (() => {
              chosen = name;
              dlg.close('pick');
            }) as EventListener,
          },
          img,
        );
      }),
    ),
    h(
      'div',
      { class: 'dlg-actions' },
      h('button', { type: 'button', class: 'btn', onclick: (() => dlg.close('')) as EventListener }, 'Cancel'),
      h(
        'button',
        { type: 'button', class: 'btn btn--primary', onclick: (() => dlg.close('upload')) as EventListener },
        'Upload a new photo',
      ),
    ),
  );
  const answer = await new Promise<string>((resolve) => {
    dlg.addEventListener('close', () => {
      resolve(dlg.returnValue);
      dlg.remove();
    });
    document.body.append(dlg);
    dlg.showModal();
  });
  if (answer === 'upload') return 'upload';
  if (answer !== 'pick') return null;

  // The full-size photo, so it can be cropped sharply. It can take a few seconds.
  toast('Opening photo…');
  const url = await store!.imageUrl(`${PATHS.library}/${chosen}`, true);
  const blob = url
    ? await fetch(url)
        .then((r) => (r.ok ? r.blob() : null))
        .catch(() => null)
    : null;
  if (!blob) {
    await dialog(
      'That photo can’t be opened',
      [h('p', {}, 'Something went wrong loading that photo. Please try again in a minute.')],
      [{ label: 'OK', value: 'ok', primary: true }],
    );
    return null;
  }
  const type = IMAGE_TYPES[chosen.split('.').pop()!.toLowerCase()];
  return new File([blob], chosen, { type });
}

async function photosScreen(arg: string) {
  const site = await readJson<{
    hero: { photos?: SitePhoto[] } & Record<string, unknown>;
    runClub?: { photos?: SitePhoto[] } & Record<string, unknown>;
    about: { photo?: SitePhoto } & Record<string, unknown>;
  }>(PATHS.site);
  const summary = errorSummary();

  // A photo already on the site (path) or a newly cropped one (data), waiting to be saved.
  // `upload` is the photo Peter chose from his device, added to his photo library on save.
  type Pic = { path: string; data: string; upload?: File; alt: Field; box: HTMLElement; img: HTMLImageElement };

  const chooseFile = () =>
    new Promise<File | null>((resolve) => {
      const input = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden' });
      const done = () => {
        resolve(input.files?.[0] ?? null);
        input.remove();
      };
      input.addEventListener('change', done);
      input.addEventListener('cancel', done);
      document.body.append(input);
      input.click();
    });

  const pick = async (slot: Slot, onPicked: (data: string, upload?: File) => void) => {
    const choice = await chooseFromLibrary();
    if (!choice) return;
    const file = choice === 'upload' ? await chooseFile() : choice;
    if (!file) return;
    try {
      const data = await cropPhoto(file, slot);
      if (data) {
        onPicked(data, choice === 'upload' ? file : undefined);
        setDirty(true);
      }
    } catch (err) {
      await dialog(
        'That photo can’t be used',
        [h('p', {}, err instanceof PhotoError ? err.message : 'Something went wrong opening that photo.')],
        [{ label: 'OK', value: 'ok', primary: true }],
      );
    }
  };

  const showPic = async (pic: Pic) => {
    pic.img.src = pic.data || (pic.path ? ((await store!.imageUrl(pic.path)) ?? '') : '');
  };
  const makePic = (photo: SitePhoto | undefined, slot: Slot, legend: string, actions: (pic: Pic) => Node[]): Pic => {
    const img = h('img', { alt: '', style: `aspect-ratio: ${slot.width} / ${slot.height}` });
    const alt = field(
      'Describe the photo',
      textInput(photo?.alt ?? '', { maxlength: 160 }),
      'For people who can’t see it, e.g. “Peter running up Arthur’s Seat”.',
    );
    const pic: Pic = { path: photo?.image ?? '', data: '', alt, img, box: h('fieldset', { class: 'box' }) };
    pic.box.append(
      h('legend', {}, legend),
      h(
        'div',
        { class: 'photo-slot' },
        img,
        h('div', { class: 'stack' }, alt.wrap, h('div', { class: 'row-actions' }, actions(pic))),
      ),
    );
    showPic(pic);
    return pic;
  };
  const replaceBtn = (pic: Pic, slot: Slot) =>
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn--small',
        onclick: (() =>
          pick(slot, (data, upload) => {
            pic.data = data;
            pic.upload = upload;
            showPic(pic);
          })) as EventListener,
      },
      'Replace photo',
    );

  const smallBtn = (label: string, onclick: () => void, extra = '') =>
    h('button', { type: 'button', class: `btn btn--small ${extra}`.trim(), onclick: onclick as EventListener }, label);

  // A carousel (top of the home page, Run Club): a list of photos to add, replace, reorder and remove.
  const carousel = (photos: SitePhoto[] | undefined, slot: Slot) => {
    const c = { pics: [] as Pic[], list: h('div', { class: 'stack' }), addBtn: h('button', { type: 'button' }) };
    const move = (pic: Pic, by: number) => {
      const i = c.pics.indexOf(pic);
      const j = i + by;
      if (j < 0 || j >= c.pics.length) return;
      [c.pics[i], c.pics[j]] = [c.pics[j], c.pics[i]];
      draw();
      setDirty(true);
    };
    const one = (photo: SitePhoto | undefined): Pic =>
      makePic(photo, slot, 'Photo', (pic) => [
        replaceBtn(pic, slot),
        smallBtn('Move up', () => move(pic, -1)),
        smallBtn('Move down', () => move(pic, 1)),
        smallBtn(
          'Remove',
          () => {
            c.pics = c.pics.filter((p) => p !== pic);
            draw();
            setDirty(true);
          },
          'btn--danger',
        ),
      ]);
    const draw = () => {
      c.pics.forEach((p, i) => (p.box.querySelector('legend')!.textContent = `Photo ${i + 1}`));
      c.list.replaceChildren(...(c.pics.length ? c.pics.map((p) => p.box) : [h('p', {}, 'No photos yet.')]));
      c.addBtn.hidden = c.pics.length >= MAX_CAROUSEL_PHOTOS;
    };
    c.addBtn = h(
      'button',
      {
        type: 'button',
        class: 'btn',
        onclick: (() =>
          pick(slot, (data, upload) => {
            const pic = one(undefined);
            pic.data = data;
            pic.upload = upload;
            showPic(pic);
            c.pics.push(pic);
            draw();
            pic.alt.input.focus();
          })) as EventListener,
      },
      '+ Add a photo',
    );
    c.pics = (photos ?? []).map((p) => one(p));
    draw();
    return c;
  };
  const hero = carousel(site.hero.photos, SLOTS.hero);
  const club = carousel(site.runClub?.photos, SLOTS.runClub);

  // Meet your coach
  const portrait = makePic(site.about.photo, SLOTS.portrait, 'Your photo', (pic) => [replaceBtn(pic, SLOTS.portrait)]);

  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save photos');
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        if (!hero.pics.length) errors.add(hero.addBtn, 'Add at least one photo for the top of the home page.');
        hero.pics.forEach((p, i) => {
          if (!p.alt.input.value.trim()) errors.add(p.alt, `Top of the home page, photo ${i + 1}: describe the photo.`);
        });
        if (!club.pics.length) errors.add(club.addBtn, 'Add at least one photo for the Run Club.');
        club.pics.forEach((p, i) => {
          if (!p.alt.input.value.trim()) errors.add(p.alt, `Run Club, photo ${i + 1}: describe the photo.`);
        });
        if (!portrait.path && !portrait.data) errors.add(portrait.box, 'Add a photo for Meet your coach.');
        else if (!portrait.alt.input.value.trim()) errors.add(portrait.alt, 'Meet your coach: describe the photo.');
        if (!errors.show()) return;

        // New photos get their own file; uploaded photos no longer used are deleted.
        // Photos from Peter's device also go in his photo library, uncropped, to use again later.
        const stamp = Date.now().toString(36);
        const changes: Change[] = [];
        const keep = async (pic: Pic, name: string): Promise<SitePhoto> => {
          const alt = pic.alt.input.value.trim();
          if (!pic.data) return { image: pic.path, alt };
          const path = `${PATHS.photos}/${name}-${stamp}.jpg`;
          changes.push({ path, image: pic.data });
          if (pic.upload) {
            const original = `${PATHS.library}/${slugify(pic.upload.name.replace(/.[^.]*$/, '')) || 'photo'}-${name}-${stamp}.jpg`;
            changes.push({ path: original, image: await resizePhoto(pic.upload) });
          }
          return { image: path, alt };
        };
        const heroPhotos: SitePhoto[] = [];
        for (const [i, p] of hero.pics.entries()) heroPhotos.push(await keep(p, `hero-${i + 1}`));
        const clubPhotos: SitePhoto[] = [];
        for (const [i, p] of club.pics.entries()) clubPhotos.push(await keep(p, `runclub-${i + 1}`));
        const portraitPhoto = await keep(portrait, 'portrait');
        const used = new Set([...heroPhotos, ...clubPhotos, portraitPhoto].map((p) => p.image));
        const before = [
          ...(site.hero.photos ?? []),
          ...(site.runClub?.photos ?? []),
          ...(site.about.photo ? [site.about.photo] : []),
        ];
        for (const old of before) {
          if (old.image.startsWith(`${PATHS.photos}/`) && !used.has(old.image))
            changes.push({ path: old.image, remove: true });
        }
        const next = {
          ...site,
          hero: { ...site.hero, photos: heroPhotos },
          ...(site.runClub && { runClub: { ...site.runClub, photos: clubPhotos } }),
          about: { ...site.about, photo: portraitPhoto },
        };
        changes.push({ path: PATHS.site, text: toJson(next) });
        if (await save(changes, 'Update photos', saveBtn)) {
          toast(savedMessage());
          route();
        }
      }) as EventListener,
    },
    h(
      'section',
      { class: 'stack', 'aria-labelledby': 'hero-photos' },
      h('h2', { id: 'hero-photos' }, 'Top of the home page'),
      h(
        'p',
        { class: 'hint' },
        `These take turns beside “Run further. Lift stronger.”, in this order. Up to ${MAX_CAROUSEL_PHOTOS} photos, ` +
          `each at least ${SLOTS.hero.width} × ${SLOTS.hero.height} pixels. When you add one, you choose which part shows.`,
      ),
      hero.list,
      hero.addBtn,
    ),
    site.runClub &&
      h(
        'section',
        { class: 'stack', id: 'runclub-photos-section', 'aria-labelledby': 'runclub-photos' },
        h('h2', { id: 'runclub-photos' }, 'Run Club'),
        h(
          'p',
          { class: 'hint' },
          `These take turns beside the Run Club details, in this order. Up to ${MAX_CAROUSEL_PHOTOS} photos, ` +
            `each at least ${SLOTS.runClub.width} × ${SLOTS.runClub.height} pixels. Group photos from your sessions work well.`,
        ),
        club.list,
        club.addBtn,
      ),
    h(
      'section',
      { class: 'stack', 'aria-labelledby': 'coach-photo' },
      h('h2', { id: 'coach-photo' }, 'Meet your coach'),
      h(
        'p',
        { class: 'hint' },
        `A square photo of you, at least ${SLOTS.portrait.width} × ${SLOTS.portrait.height} pixels.`,
      ),
      portrait.box,
    ),
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    'Photos',
    heading('Photos', 'The photos at the top of your home page, in the Run Club section and in Meet your coach.'),
    summary,
    form,
  );
  // Arriving from the Run Club page: go straight to its photos.
  if (arg === 'runclub') document.getElementById('runclub-photos-section')?.scrollIntoView();
}

// ---------- Colours (theme) ----------

/** A small picture of the site in a palette: a dark section, then a light-mode strip. */
function themePreview(p: Palette) {
  const lightBg = mix(p.paper, '#ffffff', 0.45);
  const lightAccent = mix(p.gorse, p.ink, 0.4);
  const plan = (bg: string) => h('span', { class: 'tp-plan', style: `background:${bg}` });
  return h(
    'div',
    { class: 'tp', 'aria-hidden': 'true' },
    h(
      'div',
      { class: 'tp-dark', style: `background:${p.ink};color:${p.paper}` },
      h('span', { class: 'tp-eyebrow', style: `color:${p.gorse}` }, 'Running & strength'),
      h('span', { class: 'tp-head' }, 'Run further.'),
      h('span', { class: 'tp-head', style: `color:${p.gorse}` }, 'Go past the wall.'),
      h('span', { class: 'tp-muted', style: `color:${p.stone}` }, 'Plans built around your life.'),
      h(
        'span',
        { class: 'tp-row' },
        h('span', { class: 'tp-btn', style: `background:${p.gorse};color:${p.ink}` }, 'Book a chat'),
        plan(p.loch),
        plan(p.gorse),
        plan(p.bracken),
      ),
    ),
    h(
      'div',
      { class: 'tp-light', style: `background:${lightBg};color:${p.ink}` },
      h('span', { class: 'tp-eyebrow', style: `color:${lightAccent}` }, 'Light mode'),
      h('span', { class: 'tp-muted', style: `color:${p['ink-muted']}` }, 'Text stays easy to read.'),
    ),
  );
}

async function themeScreen() {
  const raw = await store!.read(PATHS.theme);
  const saved: ThemeFile = raw ? JSON.parse(raw) : { preset: DEFAULT_PRESET, custom: null };
  const summary = errorSummary();
  const defaultBase = PRESETS.find((p) => p.id === DEFAULT_PRESET)!.base;

  // What's chosen right now: a preset id, or "custom" with five colours.
  let choice = saved.preset;
  let base: ThemeBase =
    saved.preset === 'custom' && saved.custom
      ? { ...saved.custom }
      : { ...(PRESETS.find((p) => p.id === saved.preset) ?? PRESETS[0]).base };
  const palette = () => (choice === 'custom' ? derivePalette(base) : paletteFor({ preset: choice }));

  // Preset cards
  const radios: HTMLInputElement[] = [];
  const cards = h(
    'div',
    { class: 'theme-grid', role: 'radiogroup', 'aria-label': 'Colour themes' },
    PRESETS.map((preset) => {
      const radio = h('input', {
        type: 'radio',
        name: 'theme-preset',
        value: preset.id,
        id: `theme-${preset.id}`,
        class: 'visually-hidden',
        checked: preset.id === choice,
      });
      radio.addEventListener('change', () => {
        choice = preset.id;
        base = { ...preset.base };
        update(true);
      });
      radios.push(radio);
      return h(
        'label',
        { class: 'theme-card', for: radio.id },
        radio,
        themePreview(paletteFor({ preset: preset.id })),
        h(
          'span',
          { class: 'theme-name' },
          preset.name,
          preset.id === DEFAULT_PRESET && h('span', { class: 'theme-tag' }, 'Default'),
        ),
        h('span', { class: 'hint' }, preset.description),
      );
    }),
  );

  // Fine-tuning: the five colours of the chosen theme.
  const colourFields: [keyof ThemeBase, string][] = [
    ['background', 'Dark background'],
    ['light', 'Light background'],
    ['accent', 'Accent (buttons and highlights)'],
    ['plan1', 'First coaching plan'],
    ['plan3', 'Third coaching plan'],
  ];
  const inputs = {} as Record<keyof ThemeBase, HTMLInputElement>;
  const tune = h(
    'div',
    { class: 'colour-grid' },
    colourFields.map(([key, label]) => {
      const input = h('input', { type: 'color', value: base[key] });
      input.addEventListener('input', () => {
        if (!isHex(input.value)) return;
        base[key] = input.value.toLowerCase();
        choice = 'custom';
        update(false);
      });
      inputs[key] = input;
      return field(label, input).wrap;
    }),
  );

  const bigPreview = h('div', { class: 'theme-preview' });
  const report = h('div', { class: 'theme-report', 'aria-live': 'polite' });
  const status = h('p', { class: 'hint' });

  const update = (fromPreset: boolean) => {
    radios.forEach((r) => (r.checked = r.value === choice));
    if (fromPreset) (Object.keys(inputs) as (keyof ThemeBase)[]).forEach((k) => (inputs[k].value = base[k]));
    const p = palette();
    bigPreview.replaceChildren(themePreview(p));
    const failing = checkPalette(p).filter((c) => !c.ok);
    report.replaceChildren(
      failing.length
        ? h(
            'div',
            { class: 'theme-fail' },
            h('b', {}, 'Some text would be hard to read with these colours:'),
            h(
              'ul',
              {},
              failing.map((c) => h('li', {}, `${c.label} (${c.ratio.toFixed(1)}:1, needs ${c.min}:1)`)),
            ),
            h('p', {}, 'Try a lighter accent or plan colour, or a darker background.'),
          )
        : h('p', { class: 'theme-ok' }, '✓ All text passes the readability check, in dark and light mode.'),
    );
    const name = choice === 'custom' ? 'Your own colours' : PRESETS.find((p) => p.id === choice)?.name;
    status.textContent = `Chosen: ${name}.`;
    setDirty(true);
  };

  const resetBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn',
      onclick: (() => {
        choice = DEFAULT_PRESET;
        base = { ...defaultBase };
        update(true);
      }) as EventListener,
    },
    'Reset to default',
  );

  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save colours');
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        if (checkPalette(palette()).some((c) => !c.ok))
          errors.add(report, 'Some text would be hard to read with these colours. Adjust them, or pick a theme.');
        if (!errors.show()) return;
        const next: ThemeFile =
          choice === 'custom' ? { preset: 'custom', custom: base } : { preset: choice, custom: null };
        if (await save([{ path: PATHS.theme, text: toJson(next) }], 'Update colours', saveBtn)) {
          toast(savedMessage());
          route();
        }
      }) as EventListener,
    },
    h(
      'section',
      { class: 'stack', 'aria-labelledby': 'theme-presets' },
      h('h2', { id: 'theme-presets' }, 'Choose a theme'),
      cards,
      h('div', { class: 'row-actions' }, resetBtn, status),
    ),
    h(
      'section',
      { class: 'stack', 'aria-labelledby': 'theme-tune' },
      h('h2', { id: 'theme-tune' }, 'Fine-tune (optional)'),
      h(
        'p',
        { class: 'hint' },
        'Change any of the five colours. The other shades, and light mode, are worked out from them.',
      ),
      h('div', { class: 'theme-tune' }, tune, bigPreview),
      report,
    ),
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    'Colours',
    heading(
      'Colours',
      'Change the colours of your whole website. Pentlands is the original look; "Reset to default" always brings it back.',
    ),
    summary,
    form,
  );
  update(true);
  setDirty(false);
}

// ---------- Week strip ----------

async function weekScreen() {
  const week = await readJson<Week>(PATHS.week);
  const summary = errorSummary();
  const title = field('Heading', textInput(week.title, { maxlength: 50 }));
  const days = week.days.map((d) => {
    const session = field(`${d.day}: session`, textInput(d.session, { maxlength: 20 }), 'Short, e.g. "Easy 8 km"');
    const note = field(`${d.day}: note`, textInput(d.note, { maxlength: 40 }), 'e.g. "Zone 2, conversational"');
    const highlight = h('input', { type: 'checkbox', id: `hl-${d.day}`, checked: !!d.highlight });
    return {
      d,
      session,
      note,
      highlight,
      box: h(
        'fieldset',
        { class: 'box day' },
        h('legend', {}, d.day),
        session.wrap,
        note.wrap,
        h('label', { class: 'check', for: highlight.id }, highlight, h('span', {}, 'Highlight in yellow')),
      ),
    };
  });
  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save week');
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        if (!title.input.value.trim()) errors.add(title, 'Add a heading for the week.');
        for (const r of days) {
          if (!r.session.input.value.trim()) errors.add(r.session, `${r.d.day}: add a session, or "Rest".`);
          else if (r.session.input.value.trim().length > 14)
            errors.add(r.session, `${r.d.day}: keep the session to 14 characters so it fits.`);
          if (r.note.input.value.trim().length > 30)
            errors.add(r.note, `${r.d.day}: keep the note to 30 characters so it fits.`);
        }
        if (!errors.show()) return;
        const next: Week = {
          title: title.input.value.trim(),
          days: days.map((r) => ({
            day: r.d.day,
            session: r.session.input.value.trim(),
            note: r.note.input.value.trim(),
            ...(r.highlight.checked ? { highlight: true } : {}),
          })),
        };
        if (await save([{ path: PATHS.week, text: toJson(next) }], 'Update typical week', saveBtn))
          toast(savedMessage());
      }) as EventListener,
    },
    h('div', { class: 'box' }, title.wrap),
    h(
      'div',
      { class: 'days' },
      days.map((r) => r.box),
    ),
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    'Typical week',
    sectionHeading('Typical week', 'The week of training shown under the big headline on your home page.', ''),
    summary,
    form,
  );
}

// ---------- Contact details ----------

async function contactScreen() {
  const site = await readJson<{ contact: Record<string, string>; location: Record<string, string> }>(PATHS.site);
  const { contact, location: loc } = site;
  const summary = errorSummary();
  const phone = field('Phone', textInput(contact.phone, { type: 'tel', maxlength: 20, autocomplete: 'off' }));
  const email = field('Email', textInput(contact.email, { type: 'email', maxlength: 80, autocomplete: 'off' }));
  const insta = field(
    'Instagram name',
    textInput(contact.instagram, { maxlength: 30 }),
    'Without the @, e.g. peter_rothwell.pt',
  );
  const place = field('Venue', textInput(loc.place, { maxlength: 60 }), 'e.g. "Meadowbank Shopping Park"');
  const street = field('Street address', textInput(loc.street, { maxlength: 60 }));
  const district = field(
    'Area',
    textInput((loc.area ?? '').split(',')[0].trim(), { maxlength: 40 }),
    'e.g. "Meadowbank"',
  );
  const town = field('Town or city', textInput(loc.locality, { maxlength: 40 }));
  const postcode = field('Postcode', textInput(loc.postcode, { maxlength: 10 }));
  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save contact details');

  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        const digits = phone.input.value.replace(/[\s()-]/g, '');
        if (!/^(\+44|0)\d{9,10}$/.test(digits)) errors.add(phone, 'Enter a UK phone number, like 07367 636632.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.input.value.trim()))
          errors.add(email, 'Enter an email address, like name@gmail.com.');
        const handle = insta.input.value
          .trim()
          .replace(/^@/, '')
          .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
          .replace(/\/$/, '');
        if (!/^[A-Za-z0-9._]{1,30}$/.test(handle))
          errors.add(insta, 'Enter your Instagram name using only letters, numbers, dots and underscores.');
        if (!street.input.value.trim()) errors.add(street, 'Add the street address.');
        if (!town.input.value.trim()) errors.add(town, 'Add the town or city.');
        if (!/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i.test(postcode.input.value.trim()))
          errors.add(postcode, 'Enter a UK postcode, like EH7 5TS.');
        if (!errors.show()) return;

        const pc = postcode.input.value
          .trim()
          .toUpperCase()
          .replace(/^(.+?)(\d[A-Z]{2})$/, '$1 $2')
          .replace(/\s+/g, ' ');
        const area = [district.input.value.trim(), town.input.value.trim()].filter(Boolean).join(', ');
        const address = `${[street.input.value.trim(), district.input.value.trim(), town.input.value.trim()].filter(Boolean).join(', ')} ${pc}`;
        const next = {
          ...site,
          contact: {
            ...contact,
            phone: phone.input.value.trim(),
            email: email.input.value.trim(),
            instagram: handle,
          },
          location: {
            ...loc,
            area,
            place: place.input.value.trim(),
            address,
            street: street.input.value.trim(),
            locality: town.input.value.trim(),
            postcode: pc,
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address).replace(/%20/g, '+')}`,
          },
        };
        if (await save([{ path: PATHS.site, text: toJson(next) }], 'Update contact details', saveBtn))
          toast(savedMessage());
      }) as EventListener,
    },
    h('fieldset', { class: 'box' }, h('legend', {}, 'How people reach you'), phone.wrap, email.wrap, insta.wrap),
    h(
      'fieldset',
      { class: 'box' },
      h('legend', {}, 'Where you train people in person'),
      place.wrap,
      street.wrap,
      district.wrap,
      h('div', { class: 'pair' }, town.wrap, postcode.wrap),
    ),
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    'Contact details',
    heading(
      'Contact details',
      'Your phone, email, Instagram and address. Shown at the bottom of every page and on your policies.',
    ),
    summary,
    form,
  );
}

// ---------- Policies ----------

const placeholders = (md: string) => [...md.matchAll(/<mark>([\s\S]*?)<\/mark>/g)].map((m) => m[1]);

async function policiesList() {
  const names = (await store!.list(PATHS.legal)).filter((n) => n.endsWith('.md'));
  const docs = await Promise.all(
    names.map(async (n) => {
      const { data, body } = parseDoc((await store!.read(`${PATHS.legal}/${n}`)) ?? '');
      return { id: n.replace(/\.md$/, ''), data, todo: placeholders(body).length };
    }),
  );
  docs.sort((a, b) => Number(a.data.order ?? 0) - Number(b.data.order ?? 0));
  screen(
    'Policies',
    heading('Policies', 'Your privacy policy, terms, refunds and accessibility pages.'),
    h(
      'section',
      { class: 'box' },
      h(
        'ul',
        { class: 'rows' },
        docs.map((d) =>
          h(
            'li',
            {},
            h(
              'a',
              { class: 'row', href: `#/policy/${d.id}` },
              h(
                'span',
                { class: 'row-text' },
                h('b', {}, String(d.data.title)),
                h('span', { class: 'sub' }, `Last updated ${formatDate(String(d.data.updated))}`),
              ),
              d.todo
                ? h('span', { class: 'pill pill--draft' }, `${d.todo} to fill in`)
                : h('span', { class: 'pill pill--live' }, 'Complete'),
            ),
          ),
        ),
      ),
    ),
  );
}

async function policyEditor(id: string) {
  const path = `${PATHS.legal}/${id}.md`;
  const text = await store!.read(path);
  if (text === null) {
    screen('Not found', heading('Page not found', undefined, ['#/policies', 'All policies']));
    return;
  }
  const { data, body } = parseDoc(text);
  const summary = errorSummary();
  const area = textArea(body, { rows: 24, spellcheck: true, class: 'md-input' });
  const editorField = field(
    'Page text',
    area,
    'Written in Markdown: ## for a heading, - for a bullet point, **bold**.',
  );
  const preview = h('div', { class: 'site-post site-post--legal', 'aria-live': 'off' });
  const todo = h('div', { class: 'todo' });

  const refresh = () => {
    preview.innerHTML = markdownToHtml(area.value);
    const marks = placeholders(area.value);
    todo.replaceChildren();
    if (!marks.length) {
      todo.append(h('p', { class: 'ok' }, 'Nothing left to fill in on this page.'));
      return;
    }
    todo.append(
      h(
        'p',
        {},
        h('b', {}, marks.length === 1 ? '1 thing still to fill in:' : `${marks.length} things still to fill in:`),
      ),
      h(
        'ul',
        {},
        marks.map((m) =>
          h(
            'li',
            {},
            h(
              'button',
              {
                type: 'button',
                class: 'link',
                onclick: (() => {
                  const needle = `<mark>${m}</mark>`;
                  const at = area.value.indexOf(needle);
                  if (at < 0) return;
                  area.focus();
                  area.setSelectionRange(at, at + needle.length);
                }) as EventListener,
              },
              m.replace(/^\[|\]$/g, ''),
            ),
          ),
        ),
      ),
      h(
        'p',
        { class: 'hint' },
        'Tap one to jump to it, then replace the whole highlighted part (including <mark> and </mark>) with the real details.',
      ),
    );
  };
  area.addEventListener('input', refresh);
  refresh();

  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save page');
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        if (area.value.trim().length < 100)
          errors.add(editorField, 'This page looks almost empty. Undo your changes or add the text back.');
        const opens = (area.value.match(/<mark>/g) ?? []).length;
        const closes = (area.value.match(/<\/mark>/g) ?? []).length;
        if (opens !== closes)
          errors.add(
            editorField,
            'A highlight is only half removed. Delete both <mark> and </mark> around the text you filled in.',
          );
        if (!errors.show()) return;
        const next = stringifyDoc({ ...data, updated: today() }, area.value);
        if (await save([{ path, text: next }], `Update ${String(data.title).toLowerCase()}`, saveBtn))
          toast(savedMessage());
      }) as EventListener,
    },
    h(
      'div',
      { class: 'split' },
      h('div', { class: 'box' }, editorField.wrap),
      h('div', { class: 'box' }, h('span', { class: 'label' }, 'Preview'), preview),
    ),
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    String(data.title),
    heading(String(data.title), String(data.description ?? ''), ['#/policies', 'All policies']),
    summary,
    todo,
    form,
  );
}

// ---------- Instagram ----------

async function instagramScreen() {
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

// ---------- Sign in ----------

async function signInScreen() {
  if (store?.mode === 'live') {
    location.replace('#/');
    return;
  }
  const summary = errorSummary();
  const token = field(
    'Your access key',
    textInput('', { type: 'password', autocomplete: 'off', spellcheck: false }),
    'It starts with github_pat_. You only need to do this once on each phone or computer.',
  );
  const btn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Sign in');
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack narrow',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const value = token.input.value.trim();
        const errors = new Errors(summary);
        if (!value) errors.add(token, 'Paste your access key first.');
        if (!errors.show()) return;
        btn.disabled = true;
        btn.textContent = 'Checking…';
        const problem = await checkToken(config.repo, value);
        btn.disabled = false;
        btn.textContent = 'Sign in';
        if (problem) {
          const again = new Errors(summary);
          again.add(token, problem);
          again.show();
          return;
        }
        storage.set(TOKEN_KEY, value);
        storage.remove(MODE_KEY, sessionStorage);
        store = startStore();
        toast('You’re signed in. Changes you save now go on your website.');
        location.hash = '#/';
      }) as EventListener,
    },
    h(
      'div',
      { class: 'box' },
      h(
        'ol',
        { class: 'steps' },
        h('li', {}, 'Sign in to GitHub (Jack set up your account).'),
        h(
          'li',
          {},
          'Open ',
          h(
            'a',
            { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' },
            'new access key',
          ),
          `. Name it "Website editor", choose the repository ${config.repo.split('/')[1]}, and under Permissions → Contents choose "Read and write".`,
        ),
        h('li', {}, 'Press "Generate token", copy it, and paste it below.'),
      ),
      token.wrap,
      btn,
    ),
    h(
      'p',
      {},
      'Just want to look around? ',
      h(
        'button',
        {
          type: 'button',
          class: 'link',
          onclick: (() => {
            storage.set(MODE_KEY, 'demo', sessionStorage);
            store = demoStore(config.baked);
            location.hash = '#/';
          }) as EventListener,
        },
        'Try the demo instead',
      ),
      ' (nothing you do there changes your website).',
    ),
  );
  screen(
    'Sign in',
    heading('Sign in to edit your website', 'Changes you save after signing in go live on rothwellsrunning.com.'),
    summary,
    form,
  );
}

// ---------- Start ----------

const menuBtn = document.getElementById('menu-btn')!;
menuBtn.setAttribute('aria-expanded', 'false');
menuBtn.addEventListener('click', () => {
  const open = document.querySelector('.side')!.classList.toggle('is-open');
  menuBtn.setAttribute('aria-expanded', String(open));
});
// Escape closes the phone menu and returns focus to its button.
document.querySelector('.side')!.addEventListener('keydown', (event) => {
  const side = event.currentTarget as HTMLElement;
  if ((event as KeyboardEvent).key === 'Escape' && side.classList.contains('is-open')) {
    side.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.focus();
  }
});

store = startStore();
route();
