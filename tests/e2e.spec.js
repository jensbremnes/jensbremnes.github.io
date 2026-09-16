const { test, expect } = require('@playwright/test');
const path = require('path');

const FILE_URL = `file://${path.resolve(__dirname, '../index.html')}`;

test.beforeEach(async ({ page }) => {
  await page.goto(FILE_URL);
});

test('nav links', async ({ page }) => {
  const hrefs = ['#about', '#research', '#software', '#publications', '#background', '#contact'];
  for (const href of hrefs) {
    const link = page.locator(`#nav a[href="${href}"]`);
    await expect(link).toHaveCount(1);
  }
  await expect(page.locator('#nav a[href="#talks"]')).toHaveCount(0);
});

test('hero shows UiT role', async ({ page }) => {
  await expect(page.locator('.hero-eyebrow')).toContainText('UiT The Arctic University of Norway');
  await expect(page.locator('.hero-name')).toHaveText('Jens Einar Bremnes');
  await expect(page.locator('.hero-tagline')).toContainText('autonomous systems');
});

test('github link', async ({ page }) => {
  const link = page.locator('.hero-links a[href="https://github.com/jensbremnes"]');
  await expect(link).toHaveCount(1);
});

test('contact section', async ({ page }) => {
  const section = page.locator('#contact');
  await expect(section).toBeVisible();
});

test('software section with geobn card', async ({ page }) => {
  const section = page.locator('#software');
  await expect(section).toBeVisible();
  const card = section.locator('.software-card');
  await expect(card).toHaveCount(1);
  await expect(card.locator('a[href="https://github.com/jensbremnes/geobn"]')).toHaveCount(2);
});

test('geobn demo loads the map and responds to inputs', async ({ page }) => {
  // The demo loads Leaflet and the terrain data only when scrolled near.
  await page.locator('#geobn-demo').scrollIntoViewIfNeeded();
  await expect(page.locator('#geobn-map.leaflet-container')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#geobn-map .leaflet-image-layer')).toHaveCount(1);

  const stats = page.locator('#geobn-stats');
  await expect(stats).toContainText('network queries');
  const before = await stats.textContent();
  await page.locator('#geobn-snow').fill('80');
  await page.locator('#geobn-wind').fill('25');
  await expect(stats).not.toHaveText(before);

  const entropy = page.locator('#geobn-demo [data-layer="entropy"]');
  await entropy.click();
  await expect(entropy).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#geobn-demo [data-layer="risk"]')).toHaveAttribute('aria-pressed', 'false');
});

test('projects section removed', async ({ page }) => {
  await expect(page.locator('#projects')).toHaveCount(0);
  await expect(page.locator('#nav a[href="#projects"]')).toHaveCount(0);
});

test('hero scene canvas animates', async ({ page }) => {
  const canvas = page.locator('#hero-scene-canvas');
  await expect(canvas).toBeVisible();
  const sizes = await page.evaluate(() => {
    const c = document.getElementById('hero-scene-canvas');
    return { w: c.width, h: c.height };
  });
  expect(sizes.w).toBeGreaterThan(0);
  expect(sizes.h).toBeGreaterThan(0);
  // The canvas actually gets painted (some non-transparent pixels).
  const painted = await page.evaluate(() => {
    const c = document.getElementById('hero-scene-canvas');
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return true;
    }
    return false;
  });
  expect(painted).toBe(true);
});

test('hero scene draws static frame under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(FILE_URL);
  const painted = await page.evaluate(() => {
    const c = document.getElementById('hero-scene-canvas');
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return true;
    }
    return false;
  });
  expect(painted).toBe(true);
});

test('profile photo', async ({ page }) => {
  const img = page.locator('img[src*="jens-hero.jpg"]');
  await expect(img).toHaveCount(1);
  await expect(img).toBeVisible();
});

test('talks section removed', async ({ page }) => {
  await expect(page.locator('#talks')).toHaveCount(0);
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
  const pubs = page.locator('.pub-list .pub-entry');
  const count = await pubs.count();
  expect(count).toBeGreaterThanOrEqual(20);
});

test('selected publications removed', async ({ page }) => {
  await expect(page.locator('.pub-featured')).toHaveCount(0);
});

test('google scholar link', async ({ page }) => {
  const links = page.locator('a[href*="scholar.google.com"]');
  const count = await links.count();
  expect(count).toBeGreaterThanOrEqual(1);
});

test('citation stats hooks for update workflow', async ({ page }) => {
  await expect(page.locator('#stat-citations')).toHaveText(/^\d+$/);
  await expect(page.locator('#stat-hindex')).toHaveText(/^\d+$/);
  await expect(page.locator('#stat-contact-summary')).toContainText(/\d+ citations · h-index \d+/);
});

test('dark by default, theme toggle switches and persists', async ({ page }) => {
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await page.locator('#theme-toggle').click();
  await expect(html).not.toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(html).not.toHaveAttribute('data-theme', 'dark');

  await page.locator('#theme-toggle').click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
});

// News section is commented out in index.html for now; restore this test
// together with the section and its nav link if it comes back.
// test('news section visible', async ({ page }) => {
//   await expect(page.locator('#news')).toBeVisible();
//   await expect(page.locator('#news .news-item').first()).toContainText('UiT The Arctic University of Norway');
// });
test('news section hidden', async ({ page }) => {
  await expect(page.locator('#news')).toHaveCount(0);
  await expect(page.locator('#nav a[href="#news"]')).toHaveCount(0);
});

test('publication titles link out', async ({ page }) => {
  const links = page.locator('.pub-list .pub-title a[href^="https://doi.org/"]');
  expect(await links.count()).toBeGreaterThanOrEqual(15);
});

test('publication sort by citations reorders entries', async ({ page }) => {
  await page.locator('#pub-sort-citations').click();
  const firstJournal = page.locator('#pub-list .pub-entry').first();
  await expect(firstJournal.locator('.pub-title')).toContainText(
    'A Bayesian approach to supervisory risk control'
  );
  await expect(page.locator('#pub-sort-citations')).toHaveAttribute('aria-pressed', 'true');
});

test('reduced motion keeps all sections visible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(FILE_URL);
  for (const id of ['#about', '#research', '#software', '#publications', '#background', '#contact']) {
    await expect(page.locator(id)).toBeVisible();
  }
  const revealCount = await page.locator('.reveal').count();
  expect(revealCount).toBe(0);
});
