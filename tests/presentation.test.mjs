import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
});
after(async () => browser?.close());

for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
  test(`reading portfolio at ${width}×${height} loads without the garden and opts in with history`, async () => {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'en-US', reducedMotion: 'reduce' });
    const p = await context.newPage();
    const errors = [], requests = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('request', r => requests.push(r.url()));
    await p.route('**/*open-meteo.com/**', r => r.abort());
    try {
      await p.goto(base + (width < 900 ? '/?view=read' : '/'));
      await p.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
      assert.match(await p.title(), /Chakib Belgaid.*Product engineer/);
      assert.equal(await p.locator('html').getAttribute('data-view'), 'read');
      assert.equal(await p.locator('html').getAttribute('data-journey'), null);
      assert.equal(await p.locator('#portfolio').isVisible(), true);
      assert.equal(await p.locator('#scene canvas').count(), 0);
      assert.equal(await p.locator('vite-error-overlay').count(), 0);
      assert.ok(!requests.some(url => /\/assets\/scene-|\/src\/scene|\/assets\/stills\//.test(url)), 'no 3D scene or journey stills requested before opt-in');
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

      await p.locator('#intro .project-shortcuts a[href="#whisperbook"]').click();
      await p.waitForFunction(() => document.activeElement?.id === 'whisperbook-title');
      assert.equal(await p.locator('#whisperbook .project-access a').getAttribute('href'), 'https://github.com/chakib-belgaid/whisper-book/releases/tag/v0.1');
      assert.equal(await p.locator('.research-highlights a').count(), 3);
      assert.match(await p.locator('.research-highlights').innerText(), /Archived repository/);

      await p.locator('.view-switch').click();
      await p.waitForFunction(() => !!document.querySelector('#scene canvas'), undefined, { timeout: 20000 });
      assert.match(p.url(), /view=garden/);
      assert.equal(new URL(p.url()).hash, '#whisperbook');
      await p.goBack();
      await p.waitForFunction(() => document.documentElement.dataset.view === 'read' && document.querySelector('#stage').hidden);
      assert.equal(new URL(p.url()).searchParams.get('view'), width < 900 ? 'read' : null, 'Back restores the original reader URL');
      assert.equal(await p.locator('html').getAttribute('data-journey'), null);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

test('unknown view values keep the reader and bare phone deep links open the journey', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const p = await context.newPage();
  try {
    for (const lang of ['en', 'fr', 'ar']) {
      await p.goto(`${base}/?view=unknown&lang=${lang}#wattch`);
      await p.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
      assert.equal(await p.locator('html').getAttribute('data-view'), 'read');
      assert.equal(await p.locator('html').getAttribute('lang'), lang);
      assert.equal(await p.locator('html').getAttribute('dir'), lang === 'ar' ? 'rtl' : 'ltr');
      assert.equal(await p.locator('#scene canvas').count(), 0);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (lang !== 'en') assert.doesNotMatch(await p.locator('#wattch').innerText(), /Build from source|Performance evidence/);
    }
    await p.goto(`${base}/#wattch`);
    await p.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
    // The journey selects its stop on the next animation frame after deep-link scrolling.
    await p.waitForFunction(() => document.querySelector('.journey')?.dataset.at === 'wattch');
    assert.equal(await p.locator('html').getAttribute('data-view'), 'read');
    assert.equal(await p.locator('html').getAttribute('data-journey'), 'true');
    assert.equal(await p.locator('.journey').getAttribute('data-at'), 'wattch');
    assert.equal(await p.locator('#wattch').isVisible(), true);
  } finally { await context.close(); }
});

for (const [width, height] of [[390, 844], [375, 667], [320, 568]]) {
  test(`default phone journey at ${width}×${height} animates as the visitor scrolls`, async () => {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'en-US', isMobile: true, hasTouch: true });
    const p = await context.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route('**/*open-meteo.com/**', r => r.abort());
    try {
      await p.goto(base + '/');
      await p.waitForFunction(() => !!document.querySelector('.journey[data-live] #scene canvas'));
      assert.equal(await p.locator('html').getAttribute('data-journey'), 'true');
      assert.equal(new URL(p.url()).searchParams.get('view'), null);
      const start = Number(await p.locator('#scene').getAttribute('data-progress'));
      const distance = await p.locator('[data-stop="blueprint"]').evaluate(el => el.getBoundingClientRect().top + scrollY - innerHeight * 0.7);
      await p.mouse.wheel(0, distance);
      await p.waitForFunction(start => Number(document.querySelector('#scene').dataset.progress) > start, start);
      const growth = Number(await p.locator('#scrub').inputValue());
      assert.ok(growth > 0 && growth < 330, `scroll drives the transition: ${growth}`);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await p.mouse.wheel(0, -distance);
      await p.getByRole('link', { name: 'Read as a page', exact: true }).click();
      assert.equal(await p.locator('html').getAttribute('data-journey'), null);
      await p.goBack();
      await p.waitForFunction(() => document.documentElement.dataset.journey === 'true' && document.documentElement.dataset.preview === 'true');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}

test('automatic presentation follows portrait, desktop, and landscape resizing', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US', reducedMotion: 'reduce' });
  const p = await context.newPage();
  await p.route('**/*open-meteo.com/**', r => r.abort());
  try {
    await p.goto(base + '/');
    await p.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
    assert.equal(await p.locator('#scene canvas').count(), 0);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForFunction(() => !!document.querySelector('.journey[data-live] #scene canvas'));
    await p.setViewportSize({ width: 844, height: 390 });
    await p.waitForFunction(() => !document.documentElement.dataset.journey);
    assert.equal(await p.locator('#stage').isVisible(), false);
    await p.setViewportSize({ width: 1440, height: 900 });
    assert.equal(await p.locator('html').getAttribute('data-view'), 'read');
    assert.equal(await p.locator('#stage').isVisible(), false);
  } finally { await context.close(); }
});
