import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setupPage } from './browser-fixture.mjs';

/* Auto, Full and Light drawing (OPTIMIZATION-PLAN.md, item 4). */
const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
let browser;
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => browser?.close());

async function bloom(path, options = {}) {
  return setupPage(browser, { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, ...options }, async p => {
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.route('**/*open-meteo.com/**', (r) => r.abort());
    // These fixtures exercise the opt-in garden (or an explicitly requested reader).
    const url = new URL(base + path);
    if (!url.searchParams.has('view')) url.searchParams.set('view', 'garden');
    await p.goto(url.href);
    await p.waitForFunction(() => Number(document.querySelector('#scene')?.dataset.progress) > 0.99, {}, { timeout: 15000 });
    await p.locator('.dock > summary').click();
  });
}
const pressed = (p) => p.locator('button[data-quality][aria-pressed="true"]').getAttribute('data-quality');
const canvasWidth = (p) => p.locator('#scene canvas').evaluate((c) => c.width);

test('Light draws the built garden with fewer pixels, keeps its trees, and is remembered', async () => {
  const p = await bloom('/#contact');
  try {
    assert.equal(await pressed(p), 'auto');
    assert.equal(await p.locator('#scene').getAttribute('data-quality'), 'full');
    const full = await canvasWidth(p);
    await p.locator('#plant-one').click();
    await p.locator('#plant-one').click();
    const canvas = await p.locator('#scene canvas').elementHandle();
    await p.getByRole('button', { name: 'Light', exact: true }).click();
    assert.equal(await pressed(p), 'light');
    assert.equal(await p.locator('#scene').getAttribute('data-quality'), 'light');
    // A desktop garden is drawn light, not rebuilt.
    assert.equal(await p.locator('#scene').getAttribute('data-detail'), 'full');
    assert.ok(await canvas.evaluate((c) => c.isConnected), 'the same canvas');
    assert.ok(await canvasWidth(p) < full, 'fewer pixels');
    assert.match(await p.locator('#tree-count').textContent(), /^2 of 24/);
    await p.reload();
    await p.waitForFunction(() => document.querySelector('#scene')?.dataset.quality);
    assert.equal(await p.locator('#scene').getAttribute('data-quality'), 'light');
    assert.equal(await p.locator('button[data-quality="light"]').getAttribute('aria-pressed'), 'true');
    await p.waitForFunction(() => Number(document.querySelector('#scene').dataset.progress) > 0.99, {}, { timeout: 15000 });
    await p.locator('.dock > summary').click();
    await p.getByRole('button', { name: 'Auto', exact: true }).click();
    assert.equal(await p.locator('#scene').getAttribute('data-quality'), 'full');
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});

test('Full rebuilds a lighter-built garden in place, keeping its trees and stage', async () => {
  const p = await bloom('/?quality=low#contact');
  try {
    assert.equal(await p.locator('#scene').getAttribute('data-detail'), 'low');
    await p.locator('#plant-one').click();
    await p.locator('#plant-one').click();
    await p.locator('#plant-one').click();
    await p.getByRole('button', { name: 'Full', exact: true }).click();
    await p.waitForFunction(() => document.querySelector('#scene').dataset.detail === 'full', {}, { timeout: 15000 });
    await p.waitForFunction(() => document.querySelectorAll('#scene canvas').length === 1);
    // It opens at Bloom rather than growing again from the sketch.
    await p.waitForFunction(() => document.querySelector('#scene').dataset.progress);
    assert.ok(Number(await p.locator('#scene').getAttribute('data-progress')) > 0.99);
    assert.match(await p.locator('#tree-count').textContent(), /^3 of 24/);
    assert.equal(await p.locator('#scene').getAttribute('data-quality'), 'full');
    // The visit's rendering total keeps what the first garden drew.
    assert.notEqual(await p.locator('[data-carbon-figure]').textContent(), 'Unavailable');
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});
