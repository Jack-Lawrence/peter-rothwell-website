import { describe, expect, it } from 'vitest';
import { pageFor, stateOfCommit, stateOfLatest, type Run } from '../../src/admin/deploy-status';

const run = (workflow: 'checks' | 'deploy', status: string, conclusion: string | null, event = 'push'): Run => ({
  path: `.github/workflows/${workflow}.yml`,
  status,
  conclusion,
  html_url: `https://github.com/x/y/actions/runs/${workflow}`,
  event,
  updated_at: '2026-10-09T12:00:00Z',
});

describe('stateOfCommit', () => {
  it('is updating until the deploy finishes', () => {
    expect(stateOfCommit([])).toEqual({ state: 'updating' });
    expect(stateOfCommit([run('checks', 'in_progress', null)])).toEqual({ state: 'updating' });
    expect(stateOfCommit([run('checks', 'completed', 'success')])).toEqual({ state: 'updating' });
    expect(stateOfCommit([run('checks', 'completed', 'success'), run('deploy', 'queued', null)])).toEqual({
      state: 'updating',
    });
  });

  it('is live once the deploy succeeds', () => {
    expect(stateOfCommit([run('deploy', 'completed', 'success'), run('checks', 'completed', 'success')])).toEqual({
      state: 'live',
      at: '2026-10-09T12:00:00Z',
    });
  });

  it('fails, with a link to the run, when the checks or the deploy fail', () => {
    expect(stateOfCommit([run('checks', 'completed', 'failure')])).toEqual({
      state: 'failed',
      runUrl: 'https://github.com/x/y/actions/runs/checks',
    });
    expect(stateOfCommit([run('checks', 'completed', 'success'), run('deploy', 'completed', 'failure')])).toEqual({
      state: 'failed',
      runUrl: 'https://github.com/x/y/actions/runs/deploy',
    });
  });

  it('can’t tell when a newer save replaced this one', () => {
    expect(stateOfCommit([run('checks', 'completed', 'cancelled')])).toEqual({ state: 'unknown' });
  });
});

describe('stateOfLatest', () => {
  it('ignores the hourly Instagram runs', () => {
    const runs = [
      run('deploy', 'completed', 'success', 'schedule'),
      run('deploy', 'completed', 'failure', 'workflow_run'),
    ];
    expect(stateOfLatest(runs)).toMatchObject({ state: 'failed' });
  });

  it('reports the latest change', () => {
    expect(stateOfLatest([run('deploy', 'in_progress', null, 'workflow_run')])).toEqual({ state: 'updating' });
    expect(stateOfLatest([run('deploy', 'completed', 'success', 'workflow_dispatch')])).toMatchObject({
      state: 'live',
    });
    expect(stateOfLatest([])).toEqual({ state: 'unknown' });
  });
});

describe('pageFor', () => {
  const site = 'https://jack-lawrence.github.io/peter-rothwell-website/';

  it('links to the post or policy that changed', () => {
    expect(
      pageFor(
        [
          { path: 'src/assets/journal/a.jpg' },
          { path: 'src/content/journal/my-post.md', text: '---\ntitle: "A"\n---\n' },
        ],
        site,
      ),
    ).toBe(`${site}journal/my-post/`);
    expect(pageFor([{ path: 'src/content/legal/terms.md', text: '' }], site)).toBe(`${site}terms/`);
  });

  it('links to the home page for drafts, deletions and everything else', () => {
    expect(pageFor([{ path: 'src/content/journal/a.md', text: '---\ndraft: true\n---\n' }], site)).toBe(site);
    expect(pageFor([{ path: 'src/content/journal/a.md', remove: true }], site)).toBe(site);
    expect(pageFor([{ path: 'src/data/services.json', text: '[]' }], site)).toBe(site);
  });
});
