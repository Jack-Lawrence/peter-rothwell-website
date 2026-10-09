// Shared by every admin screen: the config baked into the page, where the files
// live, the store (demo or live), saving, unsaved changes and the page layout.
import { h, toast, dialog } from './ui';
import { parseDoc } from './markdown';
import { pageFor, simulateDeploy, watchDeploy } from './deploy-status';
import { checkDataFile, checkPolicy, checkPost } from '../lib/content-rules';
import {
  demoStore,
  liveStore,
  resetDemo,
  loadToken,
  clearToken,
  SaveError,
  type Baked,
  type Store,
  type Change,
} from './store';

export const config = JSON.parse(document.getElementById('admin-config')!.textContent!) as {
  repo: string;
  preview: boolean;
  siteUrl: string;
  baked: Baked;
};

export const PATHS = {
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
export const MODE_KEY = 'rr-admin-mode';

export interface Service {
  id: string;
  label: string;
  name: string;
  price: string;
  per: string;
  points: string[];
  schedule?: { starts: string; when: string; spaces: string };
}
export interface Testimonial {
  name: string;
  service: string;
  quote: string;
  consent?: boolean;
  /** YYYY-MM-DD the client started training. */
  started?: string;
  /** YYYY-MM-DD they finished, or "ongoing". */
  ended?: string;
}
export interface Week {
  title: string;
  days: { day: string; session: string; note: string; highlight?: boolean }[];
}

// ---------- Mode and store ----------

export const storage = {
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

export let store: Store | null = null;
// Kept in memory too, so signing in still works when the browser blocks storage.
export let signedInToken: string | null = null;

export function startStore(): Store | null {
  const token = signedInToken ?? loadToken();
  if (token) return liveStore(config.repo, token);
  if (config.preview || storage.get(MODE_KEY, sessionStorage) === 'demo') return demoStore(config.baked);
  return null;
}

export const isDemo = () => store?.mode === 'demo';

export async function readJson<T>(path: string): Promise<T> {
  const text = await store!.read(path);
  if (text === null) throw new SaveError(`Couldn't find ${path}.`);
  return JSON.parse(text) as T;
}
export const toJson = (data: unknown) => `${JSON.stringify(data, null, 2)}\n`;

/** Saves, then tells Peter what happens next. */
export async function save(changes: Change[], message: string, button?: HTMLButtonElement): Promise<boolean> {
  const label = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = 'Saving…';
  }
  try {
    // Checked against the rules the build uses, so a save can't break the website.
    const problems = problemsWith(changes);
    if (problems.length) {
      toast(problems[0], 'error');
      return false;
    }
    const sha = await store!.commit(changes, `${message} (via admin)`);
    setDirty(false);
    const page = pageFor(changes, config.siteUrl);
    if (isDemo()) simulateDeploy(page);
    else watchDeploy({ repo: config.repo, token: signedInToken ?? loadToken(), sha, page });
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

// What happens next (updating, then live) shows in the bar at the top of the page.
export const savedMessage = () => (isDemo() ? 'Saved in this demo.' : 'Saved.');

/** Anything in a save that would stop the website building, in plain English. */
export function problemsWith(changes: Change[]): string[] {
  return changes.flatMap((c) => {
    if (c.text === undefined || c.remove) return [];
    if (/^src\/data\/[^/]+\.json$/.test(c.path))
      return checkDataFile(c.path, c.text).map((p) => {
        const [what, ...detail] = p.split(': ');
        return `Something in ${what} is missing or broken (${detail.join(': ')}), so nothing was saved. Jack can help.`;
      });
    const front = () => parseDoc(c.text!).data;
    if (c.path.startsWith('src/content/journal/')) return checkPost(front()).map((p) => `${p} Nothing was saved.`);
    if (c.path.startsWith('src/content/legal/')) return checkPolicy(front()).map((p) => `${p} Nothing was saved.`);
    return [];
  });
}

// ---------- Unsaved changes ----------

export let dirty = false;
export function setDirty(value: boolean) {
  dirty = value;
}
window.addEventListener('beforeunload', (e) => {
  if (dirty) e.preventDefault();
});

// ---------- Layout ----------

export const view = document.getElementById('view')!;
export const banner = document.getElementById('mode-banner')!;
export const sideFoot = document.getElementById('side-foot')!;

export function renderChrome() {
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
            clearToken();
            signedInToken = null;
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
export const WEBSITE_ROUTES = [
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

export function markNav(hash: string) {
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

export function screen(title: string, ...children: (Node | string | null | false)[]) {
  document.title = `${title} | Website editor`;
  view.replaceChildren(...(children.filter(Boolean) as Node[]));
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

export const backLink = (href: string, label: string) => h('a', { class: 'back', href }, `← ${label}`);

export function heading(title: string, intro?: string, back?: [string, string]) {
  return h(
    'div',
    { class: 'page-head' },
    back && backLink(...back),
    h('h1', {}, title),
    intro && h('p', { class: 'lede' }, intro),
  );
}

// The router lives in main.ts (it needs every screen); screens reach it through here.
export let router: () => Promise<void> = async () => {};
export function setRouter(fn: () => Promise<void>) {
  router = fn;
}
export function route() {
  return router();
}
// The address before the last change, to go back to if Peter keeps unsaved changes.
export let lastHash = location.hash;
export function setLastHash(hash: string) {
  lastHash = hash;
}
export function setStore(next: Store | null) {
  store = next;
}
export function setSignedInToken(token: string | null) {
  signedInToken = token;
}

export const trackDirty = (form: HTMLElement) => {
  form.addEventListener('input', () => setDirty(true));
  form.addEventListener('change', () => setDirty(true));
};
