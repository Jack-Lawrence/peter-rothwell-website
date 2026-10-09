// After a save, tells Peter whether his change actually went live. A live save is
// a commit to main; the Checks workflow tests it and, if it passes, the Deploy
// workflow publishes it. This reads both from the GitHub Actions API: with his
// token if it has "Actions: Read-only", otherwise without one (the repo is
// public). If neither works it says the site usually updates in a minute or two.
// Demo mode plays the same messages without asking GitHub anything.
import { h, relativeTime } from './ui';

export type DeployState =
  | { state: 'updating' }
  | { state: 'live'; at?: string }
  | { state: 'failed'; runUrl?: string }
  /** Couldn't find out (no access, or a newer change replaced this one). */
  | { state: 'unknown' }
  /** Still going after five minutes. */
  | { state: 'slow' };

export interface Run {
  path: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  event: string;
  updated_at: string;
}

const API = 'https://api.github.com';
const POLL_MS = 15_000;
const GIVE_UP_MS = 5 * 60_000;

const isChecks = (r: Run) => r.path.endsWith('/checks.yml');
const isDeploy = (r: Run) => r.path.endsWith('/deploy.yml');

/** Where one commit has got to, from the workflow runs for it. */
export function stateOfCommit(runs: Run[]): DeployState {
  const checks = runs.find(isChecks);
  const deploy = runs.find(isDeploy);
  // A newer save cancels the checks for this one; its change goes live with the newer one.
  if (checks?.conclusion === 'cancelled' || deploy?.conclusion === 'cancelled') return { state: 'unknown' };
  if (checks?.status === 'completed' && checks.conclusion !== 'success')
    return { state: 'failed', runUrl: checks.html_url };
  if (deploy?.status === 'completed')
    return deploy.conclusion === 'success'
      ? { state: 'live', at: deploy.updated_at }
      : { state: 'failed', runUrl: deploy.html_url };
  return { state: 'updating' };
}

/** The latest deploy that came from a change (the hourly Instagram runs don't count). */
export function stateOfLatest(runs: Run[]): DeployState {
  const run = runs.find((r) => isDeploy(r) && r.event !== 'schedule');
  if (!run) return { state: 'unknown' };
  if (run.status !== 'completed') return { state: 'updating' };
  return run.conclusion === 'success'
    ? { state: 'live', at: run.updated_at }
    : { state: 'failed', runUrl: run.html_url };
}

/** The page a change shows up on: a post or policy page, otherwise the home page. */
export function pageFor(changes: { path: string; text?: string; remove?: boolean }[], siteUrl: string): string {
  for (const c of changes) {
    const post = /^src\/content\/journal\/([\w-]+)\.md$/.exec(c.path);
    if (post && !c.remove && !/^draft: true$/m.test(c.text ?? '')) return `${siteUrl}journal/${post[1]}/`;
    const policy = /^src\/content\/legal\/([\w-]+)\.md$/.exec(c.path);
    if (policy && !c.remove) return `${siteUrl}${policy[1]}/`;
  }
  return siteUrl;
}

async function getRuns(repo: string, query: string, token: string | null): Promise<Run[] | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  // With the token first; without it if the token isn't allowed to read Actions.
  for (const auth of token ? [true, false] : [false]) {
    try {
      const res = await fetch(`${API}/repos/${repo}/actions/${query}`, {
        headers: auth ? { ...headers, Authorization: `Bearer ${token}` } : headers,
      });
      if (res.ok) return ((await res.json()) as { workflow_runs: Run[] }).workflow_runs;
      if (![401, 403, 404].includes(res.status)) return null;
    } catch {
      return null;
    }
  }
  return null;
}

// ---------- Showing it ----------

const bar = () => document.getElementById('deploy-status')!;

/** Shows a state in the bar under the page header (and returns the same words for a box). */
export function describe(s: DeployState, page: string, demo: boolean): Node[] {
  const link = (href: string, text: string) => h('a', { href, target: '_blank', rel: 'noopener' }, text);
  const note = demo ? h('span', { class: 'sub' }, ' (Demo: nothing really changed.)') : null;
  switch (s.state) {
    case 'updating':
      return [
        h('span', { class: 'dot dot--busy', 'aria-hidden': 'true' }),
        h('span', {}, h('b', {}, 'Updating your site…'), ' This usually takes a minute or two. You can carry on.'),
      ];
    case 'live':
      return [
        h('span', { class: 'dot dot--ok', 'aria-hidden': 'true' }),
        h(
          'span',
          {},
          h('b', {}, 'Live.'),
          s.at ? ` Updated ${relativeTime(new Date(s.at))}. ` : ' ',
          link(page, 'See it on your website ↗'),
          note,
        ),
      ];
    case 'failed':
      return [
        h('span', { class: 'dot dot--error', 'aria-hidden': 'true' }),
        h(
          'span',
          {},
          h('b', {}, 'That change didn’t go live.'),
          ' Your site is unchanged and Jack has the details. ',
          s.runUrl ? link(s.runUrl, 'Details for Jack ↗') : null,
          note,
        ),
      ];
    case 'slow':
      return [
        h('span', { class: 'dot dot--busy', 'aria-hidden': 'true' }),
        h(
          'span',
          {},
          h('b', {}, 'Still updating.'),
          ' This is taking longer than usual. Check your website again in a few minutes.',
        ),
      ];
    case 'unknown':
      return [
        h('span', { class: 'dot', 'aria-hidden': 'true' }),
        h('span', {}, h('b', {}, 'Saved.'), ' Your website usually updates within a couple of minutes.'),
      ];
  }
}

function show(s: DeployState, page: string, demo: boolean) {
  const el = bar();
  el.className = `deploy-status deploy-status--${s.state}`;
  el.replaceChildren(
    ...describe(s, page, demo),
    h(
      'button',
      {
        type: 'button',
        class: 'deploy-close',
        'aria-label': 'Hide this message',
        onclick: (() => {
          el.hidden = true;
          stop();
        }) as EventListener,
      },
      '×',
    ),
  );
  el.hidden = false;
}

// ---------- Watching one save ----------

let stop: () => void = () => {};

/** Follows a live save until it's live, fails, or five minutes pass. Pauses while the tab is hidden. */
export function watchDeploy(o: { repo: string; token: string | null; sha: string; page: string }) {
  stop();
  const started = Date.now();
  let timer = 0;
  let done = false;
  const finish = () => {
    done = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
  const tick = async () => {
    if (done || document.hidden) return;
    const runs = await getRuns(o.repo, `runs?head_sha=${o.sha}&per_page=20`, o.token);
    if (done) return;
    const s: DeployState = runs ? stateOfCommit(runs) : { state: 'unknown' };
    if (s.state === 'updating' && Date.now() - started > GIVE_UP_MS) {
      show({ state: 'slow' }, o.page, false);
      return finish();
    }
    show(s, o.page, false);
    if (s.state === 'updating') timer = window.setTimeout(tick, POLL_MS);
    else finish();
  };
  const onVisible = () => {
    clearTimeout(timer);
    if (!document.hidden) tick();
  };
  document.addEventListener('visibilitychange', onVisible);
  stop = finish;
  show({ state: 'updating' }, o.page, false);
  // The workflow runs take a few seconds to appear after the commit.
  timer = window.setTimeout(tick, 5000);
}

/** Demo mode: the same messages, without GitHub. `fail` shows what a failed update looks like. */
export function simulateDeploy(page: string, fail = false) {
  stop();
  const timer = window.setTimeout(() => {
    show(fail ? { state: 'failed' } : { state: 'live', at: new Date().toISOString() }, page, true);
  }, 4000);
  stop = () => clearTimeout(timer);
  show({ state: 'updating' }, page, true);
}

/** For the home screen: how the latest change to the site went. */
export async function latestDeploy(repo: string, token: string | null): Promise<DeployState> {
  const runs = await getRuns(repo, 'workflows/deploy.yml/runs?branch=main&event=workflow_run&per_page=5', token);
  return runs ? stateOfLatest(runs) : { state: 'unknown' };
}
