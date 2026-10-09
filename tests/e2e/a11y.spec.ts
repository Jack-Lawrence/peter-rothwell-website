import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = {
  home: '',
  post: 'journal/why-runners-should-squat/',
  terms: 'terms/',
  admin: 'admin/',
};

for (const [name, path] of Object.entries(pages)) {
  test(`${name}: no serious or critical accessibility problems (axe)`, async ({ page }) => {
    await page.goto(path);
    if (name === 'admin') await page.locator('.view h1').waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const serious = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`);
    expect(serious).toEqual([]);
  });
}
