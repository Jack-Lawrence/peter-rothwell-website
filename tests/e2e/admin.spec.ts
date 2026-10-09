import { expect, test } from '@playwright/test';

// The preview build opens the admin in demo mode: changes stay in the browser.
test('admin demo: change a price, see it saved, reset restores it', async ({ page }) => {
  await page.goto('admin/#/prices');
  const price = page.getByLabel('Price (£)').first();
  const before = await price.inputValue();
  const changed = before === '99' ? '98' : '99';

  await price.fill(changed);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('#toasts')).toContainText('Saved in this demo');
  const status = page.locator('#deploy-status');
  await expect(status).toContainText('Updating your site');
  await expect(status).toContainText('Live', { timeout: 8000 });

  await page.reload();
  await expect(page.getByLabel('Price (£)').first()).toHaveValue(changed);

  await page.getByRole('button', { name: 'Reset demo' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.locator('#toasts')).toContainText('The demo has been reset');
  await page.goto('admin/#/prices');
  await expect(page.getByLabel('Price (£)').first()).toHaveValue(before);
});

test('admin home shows the "Still to do" list', async ({ page }) => {
  await page.goto('admin/');
  const todo = page.getByRole('region', { name: 'Still to do' });
  await expect(todo).toBeVisible();
  await expect(todo).toContainText(/\d+ things? to confirm/);
});

test('every admin screen opens in demo mode without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const screens = [
    '',
    'website',
    'menu',
    'hero',
    'prices',
    'runclub',
    'about',
    'testimonials',
    'instagram',
    'journal',
    'faq',
    'getintouch',
    'week',
    'posts',
    'post/new',
    'post/why-runners-should-squat',
    'photos',
    'theme',
    'contact',
    'policies',
    'policy/terms',
    'signin',
  ];
  for (const name of screens) {
    await page.goto(`admin/#/${name}`);
    await page.locator('.view h1').waitFor();
    await expect(page.locator('.view h1'), name).not.toHaveText('Something went wrong');
  }
  expect(errors).toEqual([]);
});
