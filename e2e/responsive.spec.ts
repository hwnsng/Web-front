import { test, expect } from '@playwright/test';

for (const viewport of [
  { width: 390, height: 844, scale: 1 },
  { width: 1440, height: 900, scale: 1 },
  { width: 1920, height: 1080, scale: 1.25 },
  { width: 2560, height: 1440, scale: 1.375 },
]) {
  test(`responsive page layouts at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const path of ['/', '/todayMatchPage', '/weekMatchPage', '/rankPage', '/loginPage']) {
      await page.goto(path);
      await expect(page.locator('main, .login-page-container')).toBeVisible();
      expect(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(16 * viewport.scale);
      const overflow = await page.evaluate(() => {
        const width = window.innerWidth;
        return [...document.querySelectorAll('.header, main, .home-title, .home-actions, .weekly-schedule, .standings-panel, .login-box')]
          .filter(element => {
            const rect = element.getBoundingClientRect();
            return rect.left < -1 || rect.right > width + 1;
          }).map(element => element.className);
      });
      expect(overflow).toEqual([]);
      if (path === '/' && viewport.width >= 1440) {
        await expect(page.locator('.nav-item a').first()).toHaveCSS('font-size', `${15 * viewport.scale}px`);
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height + 1);
      }
    }
  });
}
