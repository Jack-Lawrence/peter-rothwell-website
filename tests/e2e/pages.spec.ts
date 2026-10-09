import { expect, test } from '@playwright/test';

test.describe('journal', () => {
  test('lists posts and opens one', async ({ page }) => {
    await page.goto('journal/');
    const cards = page.locator('a.post');
    expect(await cards.count()).toBeGreaterThan(0);
    const first = cards.first();
    const title = (await first.locator('.post-title').textContent())!.trim();
    await first.click();
    await expect(page).toHaveURL(/\/peter-rothwell-website\/journal\/[\w-]+\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByRole('link', { name: '← All posts' })).toHaveAttribute(
      'href',
      '/peter-rothwell-website/journal/',
    );
  });

  test('labels example posts on the preview', async ({ page }) => {
    await page.goto('journal/why-runners-should-squat/');
    await expect(page.getByText('Example post: Peter will replace this')).toBeVisible();
  });

  test('has topic pages', async ({ page }) => {
    await page.goto('journal/');
    await page.getByRole('link', { name: 'Strength', exact: true }).first().click();
    await expect(page).toHaveURL(/\/journal\/topic\/strength\/$/);
    expect(await page.locator('a.post').count()).toBeGreaterThan(0);
  });

  test('has an RSS feed', async ({ request }) => {
    const res = await request.get('journal/rss.xml');
    expect(res.ok()).toBe(true);
    expect(res.headers()['content-type']).toMatch(/xml/);
    const body = await res.text();
    expect(body).toContain('<rss');
    expect(body).toContain('/peter-rothwell-website/journal/');
  });
});

test('unknown addresses get the 404 page', async ({ page }) => {
  const res = await page.goto('no-such-page/');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const home = page.getByRole('main').getByRole('link').first();
  await expect(home).toHaveAttribute('href', /^\/peter-rothwell-website\//);
});

test.describe('preview build', () => {
  test('is hidden from search engines', async ({ page, request }) => {
    await page.goto('');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    const robots = await (await request.get('robots.txt')).text();
    expect(robots).toMatch(/^Disallow: \/$/m);
  });
});
