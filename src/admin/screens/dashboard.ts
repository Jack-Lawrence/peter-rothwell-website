// The home screen: shortcuts, the "Still to do" list, recent posts and Instagram.
import { h, relativeTime } from '../ui';
import { parseDoc } from '../markdown';
import { findTodos, type TodoItem } from '../todo';
import { PATHS, config, isDemo, signedInToken, store, readJson, screen, heading } from '../app';
import { loadToken } from '../store';
import { describe, latestDeploy, simulateDeploy } from '../deploy-status';
import { loadPosts, postRow } from './posts';

// ---------- Dashboard ----------

export const icons: Record<string, string> = {
  write: 'M4 20h4L19 9l-4-4L4 16v4z',
  price: 'M17 6.5A5 5 0 0 0 8 9v4H6m2 0v3a2 2 0 0 1-2 2h11M6 13h7',
  calendar: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M9 3v4M15 3v4',
  page: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7',
  quote: 'M5 18l-1 3 4-2h9a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v11z',
  photo: 'M4 6h16v12H4zM4 15l4-4 4 4 3-3 5 5M15 9.5h.01',
  palette:
    'M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-.9-.7-1.2-.7-2 0-.8.6-1.5 1.5-1.5H17a4 4 0 0 0 4-4c0-5-4-9-9-9zM7.5 12h.01M10 8h.01M15 8h.01',
};
export const icon = (name: string) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', icons[name]);
  svg.append(path);
  return h('span', { class: 'ico' }, svg);
};

export function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Morning, Peter' : hour < 18 ? 'Afternoon, Peter' : 'Evening, Peter';
}

/** Policy pages with their front matter and text. */
export async function loadPolicies() {
  const names = (await store!.list(PATHS.legal)).filter((n) => n.endsWith('.md'));
  return Promise.all(
    names.map(async (n) => {
      const { data, body } = parseDoc((await store!.read(`${PATHS.legal}/${n}`)) ?? '');
      return { id: n.replace(/\.md$/, ''), data, body };
    }),
  );
}

/** "Still to do": placeholders to fill in, example posts and empty optional fields. */
export function todoBox(items: TodoItem[]) {
  const head = h('h2', { id: 'todo-h' }, 'Still to do');
  if (!items.length)
    return h(
      'section',
      { class: 'box todo', 'aria-labelledby': 'todo-h' },
      head,
      h(
        'p',
        { class: 'status' },
        h('span', { class: 'dot dot--ok' }),
        h('b', {}, '✓ Nothing left to confirm. Everything on your website is in your own words.'),
      ),
    );
  const row = (item: TodoItem) => {
    const text = h('span', { class: 'row-text' }, h('b', {}, item.text), h('span', { class: 'sub' }, item.where));
    return h(
      'li',
      {},
      item.href
        ? h('a', { class: 'row', href: item.href }, text, h('span', { class: 'row-go', 'aria-hidden': 'true' }, '→'))
        : h('div', { class: 'row' }, text),
    );
  };
  return h(
    'section',
    { class: 'box todo', 'aria-labelledby': 'todo-h' },
    h(
      'div',
      { class: 'box-head' },
      head,
      h(
        'span',
        { class: 'pill pill--draft' },
        items.length === 1 ? '1 thing to confirm' : `${items.length} things to confirm`,
      ),
    ),
    h(
      'p',
      { class: 'muted' },
      'Highlighted bits on your website that only you can fill in, and a few extras. Tap one to go to where it’s changed.',
    ),
    h('ul', { class: 'rows' }, items.map(row)),
  );
}

export async function dashboard() {
  const [posts, insta, policies, site, faq, services, testimonials, week] = await Promise.all([
    loadPosts(),
    readJson<{ updated: string | null; posts: unknown[] }>(PATHS.instagram),
    loadPolicies(),
    readJson<Record<string, unknown>>(PATHS.site),
    readJson<{ question: string; answer: string }[]>(PATHS.faq),
    readJson<{ name: string }[]>(PATHS.services),
    readJson<unknown[]>(PATHS.testimonials),
    readJson<unknown>(PATHS.week),
  ]);
  const todos = findTodos({ site, faq, services, testimonials, week, posts, policies });
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
    todoBox(todos),
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
      websiteBox(),
      instagramBox(insta),
    ),
  );
}

/** How the latest change to the site went: live, updating or didn't go live. */
function websiteBox() {
  const status = h('p', { class: 'status' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), 'Checking…');
  const box = h(
    'section',
    { class: 'box', 'aria-labelledby': 'site-h' },
    h('h2', { id: 'site-h' }, 'Your website'),
    status,
  );
  if (isDemo()) {
    status.replaceChildren(...describe({ state: 'live' }, config.siteUrl, true));
    box.append(
      h(
        'p',
        { class: 'muted' },
        'After each save, a bar at the top says “Updating your site…”, then “Live” once the change is on your website. ',
        h(
          'button',
          { type: 'button', class: 'link', onclick: (() => simulateDeploy(config.siteUrl)) as EventListener },
          'Show me',
        ),
        ' · ',
        h(
          'button',
          { type: 'button', class: 'link', onclick: (() => simulateDeploy(config.siteUrl, true)) as EventListener },
          'What if a change doesn’t go live?',
        ),
      ),
    );
  } else {
    latestDeploy(config.repo, signedInToken ?? loadToken()).then((s) =>
      status.replaceChildren(...describe(s, config.siteUrl, false)),
    );
  }
  return box;
}

export function instagramBox(insta: { updated: string | null; posts: unknown[] }) {
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
