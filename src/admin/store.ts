// Where the admin reads and saves the website's files.
//
// Demo mode: starts from the files as they were when the site was built, and
// keeps every change in this browser only (localStorage).
// Live mode: reads and commits to the GitHub repo with Peter's access token.
// A save is one commit, so a post and its photos always go up together.

export interface Change {
  path: string;
  /** New text content. */
  text?: string;
  /** New image, as a data: URL. */
  image?: string;
  /** Remove the file. */
  remove?: boolean;
}

export interface Store {
  mode: 'demo' | 'live';
  read(path: string): Promise<string | null>;
  /** Names of the files in a folder. */
  list(dir: string): Promise<string[]>;
  /** A URL the browser can show for an image in the repo, or null. `full` asks for the full-size photo, not a preview. */
  imageUrl(path: string, full?: boolean): Promise<string | null>;
  /** Saves the changes. Live mode returns the new commit's SHA (demo mode returns ''). */
  commit(changes: Change[], message: string): Promise<string>;
}

export interface Baked {
  files: Record<string, string>;
  /** Built preview URLs for images already in the repo. */
  images: Record<string, string>;
  /** Built full-size URLs for the photo library. */
  originals: Record<string, string>;
}

/** Friendly error for the UI. */
export class SaveError extends Error {}

// ---------- Demo ----------

const DEMO_KEY = 'rr-admin-demo';

interface DemoOverlay {
  files: Record<string, string | null>;
  images: Record<string, string | null>;
}

function loadOverlay(): DemoOverlay {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* blocked storage or bad JSON: start fresh */
  }
  return { files: {}, images: {} };
}

export function resetDemo() {
  try {
    localStorage.removeItem(DEMO_KEY);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('rr-admin-autosave:')) localStorage.removeItem(key);
    }
  } catch {
    /* nothing to clear */
  }
}

export function demoStore(baked: Baked): Store {
  let overlay = loadOverlay();
  const files = () => {
    const all: Record<string, string> = { ...baked.files };
    for (const [path, text] of Object.entries(overlay.files)) {
      if (text === null) delete all[path];
      else all[path] = text;
    }
    return all;
  };
  const images = () => {
    const all: Record<string, string> = { ...baked.images };
    for (const [path, url] of Object.entries(overlay.images)) {
      if (url === null) delete all[path];
      else all[path] = url;
    }
    return all;
  };

  return {
    mode: 'demo',
    async read(path) {
      return files()[path] ?? null;
    },
    async list(dir) {
      const prefix = dir.replace(/\/?$/, '/');
      return [...Object.keys(files()), ...Object.keys(images())]
        .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
        .map((p) => p.slice(prefix.length));
    },
    async imageUrl(path, full = false) {
      if (path in overlay.images) return overlay.images[path];
      return (full && baked.originals[path]) || baked.images[path] || null;
    },
    async commit(changes) {
      const next: DemoOverlay = structuredClone(overlay);
      for (const c of changes) {
        if (c.remove) {
          next.files[c.path] = null;
          next.images[c.path] = null;
        } else if (c.image) next.images[c.path] = c.image;
        else if (c.text !== undefined) next.files[c.path] = c.text;
      }
      try {
        localStorage.setItem(DEMO_KEY, JSON.stringify(next));
      } catch {
        throw new SaveError(
          "This browser has run out of room for demo changes (photos take a lot of space). Press 'Reset demo' to start again.",
        );
      }
      overlay = next;
      return '';
    },
  };
}

// ---------- Live (GitHub) ----------

const API = 'https://api.github.com';
const TOKEN_KEY = 'rr-admin-token';

// On GitHub Pages the admin shares its origin (<user>.github.io) with every other Pages
// site on that account, so the token is only kept beyond this tab (localStorage) when
// Peter ticks "Keep me signed in". Otherwise it lasts until the tab closes (sessionStorage).
const tokenStores = (): Storage[] =>
  [() => sessionStorage, () => localStorage].flatMap((get) => {
    try {
      return [get()];
    } catch {
      return []; // storage blocked
    }
  });

export function loadToken(): string | null {
  for (const s of tokenStores()) {
    try {
      const token = s.getItem(TOKEN_KEY);
      if (token) return token;
    } catch {
      /* storage blocked */
    }
  }
  return null;
}

export function saveToken(token: string, remember: boolean) {
  clearToken();
  try {
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch {
    /* storage blocked: the token lasts until the page reloads */
  }
}

export function clearToken() {
  for (const s of tokenStores()) {
    try {
      s.removeItem(TOKEN_KEY);
    } catch {
      /* storage blocked */
    }
  }
}
const BRANCH = 'main';

const utf8ToBase64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const base64ToUtf8 = (b64: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

export function liveStore(repo: string, token: string): Store {
  const call = async (path: string, init: RequestInit = {}, accept = 'application/vnd.github+json') => {
    let res: Response;
    try {
      res = await fetch(`${API}/repos/${repo}${path}`, {
        ...init,
        headers: {
          Accept: accept,
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
    } catch {
      throw new SaveError("Couldn't reach GitHub. Check your internet connection and try again.");
    }
    if (res.status === 401) throw new SaveError('Your access key has expired or was removed. Please sign in again.');
    if (res.status === 403)
      throw new SaveError("Your access key isn't allowed to change the website. Please sign in again with a new one.");
    return res;
  };
  const json = async (path: string, init?: RequestInit) => {
    const res = await call(path, init);
    if (!res.ok) throw new SaveError(`GitHub said no (${res.status}). Please try again in a minute.`);
    return res.json();
  };

  return {
    mode: 'live',
    async read(path) {
      const res = await call(`/contents/${path}?ref=${BRANCH}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new SaveError(`Couldn't load ${path} (${res.status}).`);
      const body = await res.json();
      return base64ToUtf8(body.content);
    },
    async list(dir) {
      const res = await call(`/contents/${dir}?ref=${BRANCH}`);
      if (res.status === 404) return [];
      if (!res.ok) throw new SaveError(`Couldn't load ${dir} (${res.status}).`);
      const body: { name: string; type: string }[] = await res.json();
      return body.filter((f) => f.type === 'file').map((f) => f.name);
    },
    async imageUrl(path) {
      const res = await call(`/contents/${path}?ref=${BRANCH}`, {}, 'application/vnd.github.raw+json');
      if (!res.ok) return null;
      return URL.createObjectURL(await res.blob());
    },
    async commit(changes, message) {
      // One commit for all changes: blobs → tree → commit → move the branch.
      const ref = await json(`/git/ref/heads/${BRANCH}`);
      const head = await json(`/git/commits/${ref.object.sha}`);
      const tree = [];
      for (const c of changes) {
        if (c.remove) {
          tree.push({ path: c.path, mode: '100644', type: 'blob', sha: null });
          continue;
        }
        const content = c.image ? c.image.slice(c.image.indexOf(',') + 1) : utf8ToBase64(c.text ?? '');
        const blob = await json('/git/blobs', {
          method: 'POST',
          body: JSON.stringify({ content, encoding: 'base64' }),
        });
        tree.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha });
      }
      const newTree = await json('/git/trees', {
        method: 'POST',
        body: JSON.stringify({ base_tree: head.tree.sha, tree }),
      });
      const commit = await json('/git/commits', {
        method: 'POST',
        body: JSON.stringify({ message, tree: newTree.sha, parents: [head.sha] }),
      });
      const moved = await call(`/git/refs/heads/${BRANCH}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha, force: false }),
      });
      if (!moved.ok) {
        throw new SaveError('The website was changed somewhere else at the same time. Reload the page and try again.');
      }
      return commit.sha as string;
    },
  };
}

/** Checks a pasted token can write to the repo. Returns an error message, or null if it's fine. */
export async function checkToken(repo: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(`${API}/repos/${repo}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return "That access key wasn't recognised. Check you copied all of it.";
    if (res.status === 404)
      return "That access key can't see the website's files. Make sure you chose the right repository.";
    if (!res.ok) return `GitHub said no (${res.status}). Please try again.`;
    const body = await res.json();
    if (!body.permissions?.push) return 'That access key can only read. It needs "Contents: Read and write".';
    return null;
  } catch {
    return "Couldn't reach GitHub. Check your internet connection and try again.";
  }
}
