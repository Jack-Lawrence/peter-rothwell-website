import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { width: 375, height: 812 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 929 },
];

for (const size of viewports) {
  test(`home page layout at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('');
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      firstScreenBottom: document.querySelector('.first-screen')!.getBoundingClientRect().bottom,
      coaching: document.querySelector('#coaching')!.getBoundingClientRect().height,
      height: window.innerHeight,
    }));
    expect(m.overflow, 'no sideways scrolling').toBeLessThanOrEqual(0);
    if (size.width > 900) {
      expect(Math.abs(m.firstScreenBottom - m.height), 'hero and week strip fill the first screen').toBeLessThanOrEqual(
        1,
      );
      expect(Math.abs(m.coaching - m.height), '"Ways to train" fills one screen').toBeLessThanOrEqual(1);
    }
  });
}

test.describe('mobile menu', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('opens, closes with Escape and leaves nothing unreachable', async ({ page }) => {
    await page.goto('');
    const button = page.getByRole('button', { name: 'Menu' });
    const menu = page.getByRole('navigation', { name: 'Mobile' });
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(menu.getByRole('link', { name: 'Journal' })).toBeVisible();
    expect(await page.locator('main').evaluate((el) => el.closest('[inert]') !== null)).toBe(true);

    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();
    expect(await page.locator('[inert]').count()).toBe(0);
  });

  test('links work', async ({ page }) => {
    await page.goto('');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: 'Journal' }).click();
    await expect(page).toHaveURL(/\/peter-rothwell-website\/journal\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test('light/dark toggle switches and is remembered', async ({ page }) => {
  await page.goto('');
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(html).not.toHaveAttribute('data-theme', 'light');
});

test.describe('hero carousel', () => {
  const active = (page: Page) =>
    page
      .locator('[data-carousel]')
      .first()
      .evaluate((box) => [...box.querySelectorAll('[data-slide]')].findIndex((s) => s.classList.contains('is-active')));
  // Clicking leaves the pointer and focus on the carousel, which also holds it still.
  const moveAway = async (page: Page) => {
    await page.mouse.move(1, 1);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  };

  test('moves on by itself, and with the next button', async ({ page }) => {
    await page.clock.install();
    await page.goto('');
    expect(await active(page)).toBe(0);
    await page.clock.runFor(6500);
    expect(await active(page)).toBe(1);
    await page
      .getByRole('button', { name: /^Next photo/ })
      .first()
      .click();
    expect(await active(page)).toBe(2);
  });

  test('loads only the first photo up front', async ({ page }) => {
    await page.goto('');
    const later = page.locator('[data-carousel]').first().locator('[data-slide].is-later');
    expect(await later.count()).toBeGreaterThan(0);
    expect(await later.first().evaluate((el) => getComputedStyle(el).display)).toBe('none');
  });

  test('the pause button stops it until played again', async ({ page }) => {
    await page.clock.install();
    await page.goto('');
    const pause = page.getByRole('button', { name: 'Pause photos' }).first();
    await pause.click();
    await expect(page.getByRole('button', { name: 'Play photos' }).first()).toBeVisible();
    await moveAway(page);
    await page.clock.runFor(20_000);
    expect(await active(page)).toBe(0);

    await page.getByRole('button', { name: 'Play photos' }).first().click();
    await moveAway(page);
    await page.clock.runFor(6500);
    expect(await active(page)).toBe(1);
  });

  test('stays still while off screen', async ({ page }) => {
    await page.clock.install();
    await page.goto('');
    await page.locator('#faq, footer').last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    await page.clock.runFor(20_000);
    expect(await active(page)).toBe(0);
  });

  test('never moves with reduced motion, and has no pause button', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    await page.goto('');
    await expect(page.getByRole('button', { name: 'Pause photos' }).first()).toBeHidden();
    await page.clock.runFor(20_000);
    expect(await active(page)).toBe(0);
  });
});

test.describe('enquiry form (preview demo mode)', () => {
  test('shows validation errors, then the demo message, and sends nothing', async ({ page }) => {
    const sent: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://localhost')) sent.push(r.url());
    });
    await page.clock.install();
    await page.goto('#contact');
    await page.clock.runFor(5000); // past the 4-second time trap

    const form = page.locator('[data-enquiry]');
    await form.getByLabel('Name').click();
    await form.getByRole('button', { name: 'Send enquiry' }).click();
    await expect(form.locator('[data-status]')).toContainText('Please add your name');
    await expect(form.getByLabel('Name')).toHaveAttribute('aria-invalid', 'true');

    await form.getByLabel('Name').fill('Sam Runner');
    await form.getByLabel('Email').fill('sam@example.com');
    await form.getByLabel("I'm interested in").selectOption({ index: 1 });
    await form.getByLabel('Your message').fill('Training for my first ultra next spring.');
    await form.getByRole('button', { name: 'Send enquiry' }).click();

    await expect(page.locator('[data-done]')).toBeVisible();
    await expect(page.locator('[data-done-text]')).toContainText('Thanks, Sam');
    await expect(page.locator('[data-demo-note]')).toBeVisible();
    expect(sent.filter((u) => u.includes('web3forms'))).toEqual([]);
  });
});
