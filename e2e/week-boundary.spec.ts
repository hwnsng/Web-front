import { test, expect } from '@playwright/test';

for (const scenario of [
  { today: '2026-10-24', heading: '10월 4주차', range: '2026년 10/18 (일) ~ 10/24 (토)', monday: '10/19', friday: '10/23' },
  { today: '2026-10-25', heading: '10월 5주차', range: '2026년 10/25 (일) ~ 10/31 (토)', monday: '10/26', friday: '10/30' },
  { today: '2026-11-01', heading: '11월 1주차', range: '2026년 11/1 (일) ~ 11/7 (토)', monday: '11/2', friday: '11/6' },
  { today: '2027-01-03', heading: '1월 2주차', range: '2027년 1/3 (일) ~ 1/9 (토)', monday: '1/4', friday: '1/8' },
]) {
  test(`Sunday-based schedule for ${scenario.today}`, async ({ page }) => {
    await page.route('**/api/state', route => route.fulfill({ json: {
      admin: false, today: scenario.today, teams: [], matches: [], standings: [],
    } }));
    await page.goto('/weekMatchPage');
    await expect(page.getByRole('heading', { name: `이번 주 · ${scenario.heading}` })).toBeVisible();
    await expect(page.locator('.weekly-heading')).toContainText(scenario.range);
    await expect(page.locator('.weekly-day')).toHaveCount(5);
    await expect(page.getByRole('region', { name: `${scenario.monday} 월요일`, exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: `${scenario.friday} 금요일`, exact: true })).toBeVisible();
  });
}
