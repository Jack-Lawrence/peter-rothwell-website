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

function markNav(hash: string) {
  document.querySelectorAll<HTMLAnchorElement>('.side-nav a').forEach((a) => {
    const target = a.getAttribute('href')!;
    const on =
      target === '#/' ? hash === '#/' : hash.startsWith(target) || (target === '#/posts' && hash.startsWith('#/post/'));
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
      prices: pricesScreen,
      runclub: runClubScreen,
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
      action('#/post/new', 'write', 'Write a blog post', 'Training tips, race reports, club news'),
      action('#/prices', 'price', 'Change prices', 'Coaching, PT and Run Club'),
      action('#/runclub', 'calendar', 'Set Run Club dates', 'Next block, time, spaces left'),
      action('#/testimonials/new', 'quote', 'Add a testimonial', 'A client’s kind words'),
      action('#/photos', 'photo', 'Change photos', 'Home page and Meet your coach'),
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

interface Draft {
  title: string;
  topic: string;
  excerpt: string;
  html: string;
  coverPath: string;
  coverData: string;
  coverAlt: string;
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
  [title, excerpt, topic, coverAlt].forEach((f) => f.input.addEventListener('input', changed));

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
      date: String(front.date ?? '') || today(),
      topic: topic.input.value.trim(),
      excerpt: excerpt.input.value.trim(),
      cover: coverPath,
      coverAlt: coverPath ? coverAlt.input.value.trim() : '',
      draft: draft || '',
      sample: front.sample === true || '',
    };
    // A draft published for the first time gets today's date.
    if (!draft && front.draft === true) data.date = today();
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
        h(
          'p',
          { class: 'mono' },
          `${topic.input.value || 'Topic'} · ${formatDate(String(front.date ?? '') || today())}`,
        ),
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

// ---------- Prices ----------

async function pricesScreen() {
  const services = await readJson<Service[]>(PATHS.services);
  const summary = errorSummary();
  const rows = services.map((s) => {
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
    const box = h(
      'fieldset',
      { class: 'box' },
      h('legend', {}, s.name),
      name.wrap,
      label.wrap,
      h('div', { class: 'pair' }, price.wrap, per.wrap),
      points.wrap,
    );
    return { s, name, label, price, per, points, box };
  });

  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save prices');
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        for (const r of rows) {
          const n = r.name.input.value.trim() || r.s.name;
          if (!r.name.input.value.trim()) errors.add(r.name, `Give the ${r.s.name} plan a name.`);
          if (!/^\d+(\.\d{1,2})?$/.test(r.price.input.value.trim()))
            errors.add(r.price, `${n}: the price should be a number, like 80 or 79.50.`);
          if (!r.per.input.value.trim()) errors.add(r.per, `${n}: say what the price is per, like "month".`);
          const pts = r.points.input.value
            .split('\n')
            .map((p) => p.trim())
            .filter(Boolean);
          if (pts.length === 0) errors.add(r.points, `${n}: add at least one thing that’s included.`);
          else if (pts.length > 6) errors.add(r.points, `${n}: keep it to 6 points or fewer so the cards stay tidy.`);
          else if (pts.some((p) => p.length > 70)) errors.add(r.points, `${n}: keep each point under 70 characters.`);
        }
        if (!errors.show()) return;
        const next = rows.map((r) => ({
          ...r.s,
          label: r.label.input.value.trim(),
          name: r.name.input.value.trim(),
          price: `£${r.price.input.value.trim()}`,
          per: `/ ${r.per.input.value.trim()}`,
          points: r.points.input.value
            .split('\n')
            .map((p) => p.trim())
            .filter(Boolean),
        }));
        if (await save([{ path: PATHS.services, text: toJson(next) }], 'Update prices', saveBtn)) toast(savedMessage());
      }) as EventListener,
    },
    rows.map((r) => r.box),
    h('div', { class: 'save-bar' }, saveBtn),
  );
  trackDirty(form);
  screen(
    'Services & prices',
    heading('Services & prices', 'Change what each plan costs and what’s included.'),
    summary,
    form,
  );
}

// ---------- Run Club dates ----------

async function runClubScreen() {
  const services = await readJson<Service[]>(PATHS.services);
  const club = services.find((s) => s.id === 'runclub');
  if (!club) {
    screen('Run Club dates', heading('Run Club dates'), h('p', {}, 'The Run Club plan is missing from your services.'));
    return;
  }
  const sched = club.schedule ?? { starts: '', when: '', spaces: '' };
  const summary = errorSummary();
  const starts = field('Next block starts', h('input', { type: 'date', value: sched.starts }));
  const when = field('Day and time', textInput(sched.when, { maxlength: 40 }), 'e.g. "Tuesdays, 6:30pm"');
  const spaces = field(
    'Spaces left (optional)',
    textInput(sched.spaces, { inputmode: 'numeric', maxlength: 3 }),
    'Leave empty to hide it.',
  );
  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save dates');

  const persist = async (schedule: Service['schedule'], message: string, button: HTMLButtonElement) => {
    const next = services.map((s) => (s.id === 'runclub' ? { ...s, schedule } : s));
    if (await save([{ path: PATHS.services, text: toJson(next) }], message, button)) toast(savedMessage());
  };

  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
        const date = (starts.input as HTMLInputElement).value;
        if (!date) errors.add(starts, 'Choose the date the next block starts.');
        else if (date < today()) errors.add(starts, 'That date is in the past. Choose the next block’s start date.');
        if (!when.input.value.trim()) errors.add(when, 'Say which day and time, for example "Tuesdays, 6:30pm".');
        if (spaces.input.value.trim() && !/^\d{1,3}$/.test(spaces.input.value.trim()))
          errors.add(spaces, 'Spaces left should be a number, like 6. Or leave it empty.');
        if (!errors.show()) return;
        await persist(
          { starts: date, when: when.input.value.trim(), spaces: spaces.input.value.trim() },
          'Update Run Club dates',
          saveBtn,
        );
      }) as EventListener,
    },
    h('div', { class: 'box' }, starts.wrap, when.wrap, spaces.wrap),
    h(
      'div',
      { class: 'save-bar' },
      saveBtn,
      sched.starts &&
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--big',
            onclick: (async (e: Event) => {
              await persist(undefined, 'Clear Run Club dates', e.currentTarget as HTMLButtonElement);
              route();
            }) as EventListener,
          },
          'Hide dates from the website',
        ),
    ),
  );
  trackDirty(form);
  screen(
    'Run Club dates',
    heading('Run Club dates', 'These show on the Run Club card on your home page. Leave them empty to hide them.'),
    summary,
    form,
  );
}

// ---------- Testimonials ----------

async function testimonialsScreen(arg: string) {
  const items = await readJson<Testimonial[]>(PATHS.testimonials);
  const services = await readJson<Service[]>(PATHS.services);
  const summary = errorSummary();
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

  const saveBtn = h('button', { type: 'submit', class: 'btn btn--primary btn--big' }, 'Save testimonials');
  const form = h(
    'form',
    {
      novalidate: true,
      class: 'stack',
      onsubmit: (async (e: Event) => {
        e.preventDefault();
        const errors = new Errors(summary);
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
        if (await save([{ path: PATHS.testimonials, text: toJson(next) }], 'Update testimonials', saveBtn)) {
          toast(savedMessage());
          history.replaceState(null, '', '#/testimonials');
          lastHash = location.hash;
          route();
        }
      }) as EventListener,
    },
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
    'Testimonials',
    heading(
      'Testimonials',
      'Kind words from clients, shown on your home page. Only add ones the client has agreed to share.',
    ),
    summary,
    form,
  );
  if (arg === 'new') addRow();
}

// ---------- Photos (hero carousel and Meet your coach) ----------

interface SitePhoto {
  image: string;
  alt: string;
}
const MAX_HERO_PHOTOS = 6;
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

async function photosScreen() {
  const site = await readJson<{
    hero: { photos?: SitePhoto[] } & Record<string, unknown>;
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

  // Hero carousel
  let heroPics: Pic[] = [];
  const heroList = h('div', { class: 'stack' });
  const addHeroBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn',
      onclick: (() =>
        pick(SLOTS.hero, (data, upload) => {
          const pic = heroPic(undefined);
          pic.data = data;
          pic.upload = upload;
          showPic(pic);
          heroPics.push(pic);
          drawHero();
          pic.alt.input.focus();
        })) as EventListener,
    },
    '+ Add a photo',
  );
  const moveHero = (pic: Pic, by: number) => {
    const i = heroPics.indexOf(pic);
    const j = i + by;
    if (j < 0 || j >= heroPics.length) return;
    [heroPics[i], heroPics[j]] = [heroPics[j], heroPics[i]];
    drawHero();
    setDirty(true);
  };
  const smallBtn = (label: string, onclick: () => void, extra = '') =>
    h('button', { type: 'button', class: `btn btn--small ${extra}`.trim(), onclick: onclick as EventListener }, label);
  const heroPic = (photo: SitePhoto | undefined): Pic =>
    makePic(photo, SLOTS.hero, 'Photo', (pic) => [
      replaceBtn(pic, SLOTS.hero),
      smallBtn('Move up', () => moveHero(pic, -1)),
      smallBtn('Move down', () => moveHero(pic, 1)),
      smallBtn(
        'Remove',
        () => {
          heroPics = heroPics.filter((p) => p !== pic);
          drawHero();
          setDirty(true);
        },
        'btn--danger',
      ),
    ]);
  const drawHero = () => {
    heroPics.forEach((p, i) => (p.box.querySelector('legend')!.textContent = `Photo ${i + 1}`));
    heroList.replaceChildren(...(heroPics.length ? heroPics.map((p) => p.box) : [h('p', {}, 'No photos yet.')]));
    addHeroBtn.hidden = heroPics.length >= MAX_HERO_PHOTOS;
  };
  heroPics = (site.hero.photos ?? []).map((p) => heroPic(p));
  drawHero();

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
        if (!heroPics.length) errors.add(addHeroBtn, 'Add at least one photo for the top of the home page.');
        heroPics.forEach((p, i) => {
          if (!p.alt.input.value.trim()) errors.add(p.alt, `Photo ${i + 1}: describe the photo.`);
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
        for (const [i, p] of heroPics.entries()) heroPhotos.push(await keep(p, `hero-${i + 1}`));
        const portraitPhoto = await keep(portrait, 'portrait');
        const used = new Set([...heroPhotos, portraitPhoto].map((p) => p.image));
        const before = [...(site.hero.photos ?? []), ...(site.about.photo ? [site.about.photo] : [])];
        for (const old of before) {
          if (old.image.startsWith(`${PATHS.photos}/`) && !used.has(old.image))
            changes.push({ path: old.image, remove: true });
        }
        const next = {
          ...site,
          hero: { ...site.hero, photos: heroPhotos },
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
        `These take turns beside “Run further. Lift stronger.”, in this order. Up to ${MAX_HERO_PHOTOS} photos, ` +
          `each at least ${SLOTS.hero.width} × ${SLOTS.hero.height} pixels. When you add one, you choose which part shows.`,
      ),
      heroList,
      addHeroBtn,
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
    heading('Photos', 'The photos at the top of your home page and in the Meet your coach section.'),
    summary,
    form,
  );
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
    heading('Typical week', 'The week of training shown under the big headline on your home page.'),
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
  const note = field(
    'How people book',
    textInput(contact.bookingNote, { maxlength: 60 }),
    'Shown above your prices, e.g. "All bookings by text or email"',
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
        if (!note.input.value.trim()) errors.add(note, 'Say how people book, e.g. "All bookings by text or email".');
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
            bookingNote: note.input.value.trim(),
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
    h(
      'fieldset',
      { class: 'box' },
      h('legend', {}, 'How people reach you'),
      phone.wrap,
      email.wrap,
      insta.wrap,
      note.wrap,
    ),
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
    heading('Contact details', 'Shown at the bottom of every page and on your policies.'),
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
  screen(
    'Instagram feed',
    heading('Instagram feed', 'Your latest Instagram posts show on the home page by themselves.'),
    h('div', { class: 'narrow' }, instagramBox(insta)),
  );
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
