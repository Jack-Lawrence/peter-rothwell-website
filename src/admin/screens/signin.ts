// Signing in with a GitHub access key, or trying the demo.
import { h, field, textInput, Errors, errorSummary, toast } from '../ui';
import { demoStore, checkToken, saveToken } from '../store';
import { config, MODE_KEY, storage, store, startStore, screen, heading, setStore, setSignedInToken } from '../app';

// ---------- Sign in ----------

export async function signInScreen() {
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
  const remember = h('input', { type: 'checkbox', id: 'remember-me' });
  const rememberWrap = h(
    'div',
    { class: 'field' },
    h('label', { class: 'check', for: remember.id }, remember, 'Keep me signed in on this device'),
    h(
      'p',
      { class: 'hint' },
      'Only tick this on your own phone or computer. Otherwise you’re signed out when you close this tab.',
    ),
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
        saveToken(value, remember.checked);
        setSignedInToken(value);
        storage.remove(MODE_KEY, sessionStorage);
        setStore(startStore());
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
          `. Name it "Website editor", choose the repository ${config.repo.split('/')[1]}, and under Permissions choose Contents: "Read and write" and Actions: "Read-only" (so the editor can tell you when a change is live).`,
        ),
        h('li', {}, 'Press "Generate token", copy it, and paste it below.'),
      ),
      token.wrap,
      rememberWrap,
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
            setStore(demoStore(config.baked));
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
    heading(
      'Sign in to edit your website',
      `Changes you save after signing in go live on ${config.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}.`,
    ),
    summary,
    form,
  );
}
