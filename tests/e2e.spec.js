const { test, expect } = require('@playwright/test');
const path = require('path');

const FILE_URL = `file://${path.resolve(__dirname, '../index.html')}`;

test.beforeEach(async ({ page }) => {
  await page.goto(FILE_URL);
});

test('nav links', async ({ page }) => {
  const hrefs = ['#about', '#research', '#teaching', '#contact'];
  for (const href of hrefs) {
    const link = page.locator(`nav a[href="${href}"]`);
    await expect(link).toHaveCount(1);
  }
});

test('github link', async ({ page }) => {
  const link = page.locator('#contact a[href="https://github.com/jensbremnes"]');
  await expect(link).toHaveCount(1);
});

test('contact section', async ({ page }) => {
  const section = page.locator('#contact');
  await expect(section).toBeVisible();
});

test('profile photo', async ({ page }) => {
  const img = page.locator('img[src*="jens.JPG"]');
  await expect(img).toHaveCount(1);
  await expect(img).toBeVisible();
});

test('viewport 375px - no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(FILE_URL);
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow).toBe(false);
});

test('viewport 1280px - no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(FILE_URL);
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow).toBe(false);
});

test('publications count', async ({ page }) => {
  const pubs = page.locator('.pub-entry');
  const count = await pubs.count();
  expect(count).toBeGreaterThanOrEqual(16);
});

test('google scholar link', async ({ page }) => {
  const link = page.locator('a[href*="scholar.google.com"]');
  await expect(link).toHaveCount(1);
});
