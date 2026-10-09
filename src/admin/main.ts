// The admin app: a few simple screens over the website's content files.
// The router and start-up are here; the screens are in ./screens/, shared pieces in ./app.ts.
import { h } from './ui';
import { SaveError } from './store';
import {
  store,
  startStore,
  dirty,
  setDirty,
  view,
  renderChrome,
  markNav,
  screen,
  heading,
  setRouter,
  route,
  lastHash,
  setLastHash,
  setStore,
} from './app';
import { postsList, postEditor } from './screens/posts';
import { dashboard } from './screens/dashboard';
import {
  websiteScreen,
  menuScreen,
  heroScreen,
  aboutScreen,
  journalScreen,
  getInTouchScreen,
  instagramScreen,
} from './screens/website';
import { pricesScreen } from './screens/prices';
import { runClubScreen } from './screens/runclub';
import { faqScreen } from './screens/faq';
import { testimonialsScreen } from './screens/testimonials';
import { photosScreen } from './screens/photos';
import { themeScreen } from './screens/theme';
import { weekScreen } from './screens/week';
import { contactScreen } from './screens/contact';
import { policiesList, policyEditor } from './screens/policies';
import { signInScreen } from './screens/signin';

// ---------- Router ----------

let routing = 0;
async function runRoute() {
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

window.addEventListener('hashchange', () => {
  if (dirty && !confirm('You have changes that are not saved yet. Leave this page and lose them?')) {
    history.replaceState(null, '', lastHash);
    return;
  }
  setDirty(false);
  setLastHash(location.hash);
  route();
});

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

setRouter(runRoute);
setStore(startStore());
route();
