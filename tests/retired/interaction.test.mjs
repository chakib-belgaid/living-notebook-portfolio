import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setupPage } from '../browser-fixture.mjs';

/* Feedback for the visitor's actions (OPTIMIZATION-PLAN.md, items 7 and 8). */
const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
const performanceBudgets = process.env.PERFORMANCE_BUDGETS === '1';
let browser;
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => browser?.close());

async function bloom(path = '/#contact', options = {}, init, grown = 0.99) {
  return setupPage(browser, { viewport: { width: 1440, height: 900 }, ...options }, async p => {
    // Visits need daylight; Date is fixed without changing animation/timer cadence.
    await p.clock.setFixedTime(new Date('2026-10-06T12:00:00Z'));
    p.errors = [];
    p.on('pageerror', (e) => p.errors.push(e.message));
    await p.route('**/*open-meteo.com/**', (r) => r.abort());
    if (init) await p.addInitScript(init);
    // These fixtures exercise the opt-in garden (or an explicitly requested reader).
    const url = new URL(base + path);
    if (!url.searchParams.has('view')) url.searchParams.set('view', 'garden');
    await p.goto(url.href);
    await p.waitForFunction((grown) => Number(document.querySelector('#scene')?.dataset.progress) > grown, grown, { timeout: 15000 });
  });
}
const hover = (p) => p.locator('#scene').getAttribute('data-hover');
/* Milliseconds from an event on the label to the garden's answer. */
const answerTime = (p, spot, type) => p.evaluate(([spot, type]) => new Promise((resolve, reject) => {
  const scene = document.querySelector('#scene');
  const label = document.querySelector(`.hotspot[data-spot="${spot}"]`);
  const start = performance.now();
  const observer = new MutationObserver(() => {
    if (scene.dataset.hover === spot) {
      observer.disconnect();
      clearTimeout(timer);
      resolve(performance.now() - start);
    }
  });
  const timer = setTimeout(() => { observer.disconnect(); reject(new Error(`No ${type} response for ${spot}`)); }, 30000);
  observer.observe(scene, { attributes: true, attributeFilter: ['data-hover'] });
  if (type === 'focus') label.querySelector('a').focus();
  else label.dispatchEvent(new PointerEvent('pointerenter'));
}), [spot, type]);
async function answered(p, spot, type, t) {
  const ms = await answerTime(p, spot, type);
  assert.equal(await hover(p), spot, `${type} highlights ${spot}`);
  t.diagnostic(`${spot} ${type} response: ${ms.toFixed(1)} ms`);
  if (performanceBudgets) assert.ok(ms < 100, `${spot} ${type} response ${ms.toFixed(1)} ms exceeds the 100 ms budget`);
}

test('a building answers its label pointed at or focused', async t => {
  const p = await bloom();
  try {
    // These labels move with the camera. Hover them during that movement and
    // verify the real pointer response instead of waiting for identical pixels.
    await p.locator('.hotspot[data-spot="whisperbook"]').hover({ force: true });
    await p.waitForFunction(() => document.querySelector('#scene').dataset.hover === 'whisperbook');
    await p.mouse.move(5, 450);
    await p.waitForFunction(() => document.querySelector('#scene').dataset.hover === 'none');
    await answered(p, 'wattch', 'pointer', t);
    await p.evaluate(() => document.querySelector('.hotspot[data-spot="wattch"]').dispatchEvent(new PointerEvent('pointerleave')));
    await p.waitForFunction(() => document.querySelector('#scene').dataset.hover === 'none');
    // The keyboard gets the same answer, and leaving clears it.
    await answered(p, 'contact', 'focus', t);
    assert.equal(await p.locator('.hotspot[data-spot="contact"] a').evaluate((a) => getComputedStyle(a.parentElement).backgroundColor !== 'rgba(0, 0, 0, 0)'), true);
    await p.keyboard.press('Shift+Tab');
    await p.waitForFunction(() => document.querySelector('#scene').dataset.hover !== 'contact');
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});

test('a fragment change interrupts an unfinished garden navigation', async () => {
  const p = await bloom('/#whisperbook', {}, undefined, 0.6);
  try {
    const target = await p.locator('.chapter').evaluateAll(chapters =>
      chapters.find(chapter => chapter.querySelector('h2')?.textContent === 'Wattch Core').offsetTop);
    await p.getByRole('link', { name: 'Back to all work' }).click();
    await p.waitForFunction(() => location.hash === '#work');
    // A new fragment arrives while the previous link is still gliding.
    await p.evaluate(() => { location.hash = 'wattch'; });
    await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.match(p.url(), /#wattch$/);
    assert.ok(Math.abs(await p.evaluate(() => scrollY) - target) < 1, 'the old glide must not move the requested project');
    assert.equal(await p.locator('.chapter.active h2').innerText(), 'Wattch Core');
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});

test('close on a project, a visible link leads back to all the work', async () => {
  // Whisperbook is a Build stop.
  const p = await bloom('/#whisperbook', {}, undefined, 0.6);
  try {
    const back = p.getByRole('link', { name: 'Back to all work' });
    await back.waitFor({ state: 'visible' });
    await back.click();
    await p.waitForFunction(() => location.hash === '#work');
    await p.waitForFunction(() => document.activeElement?.closest('.chapter.active') !== null, {}, { timeout: 8000 });
    await back.waitFor({ state: 'hidden' });
    // Once the glide to the overview has come to rest:
    for (let y = -1, i = 0; i < 20; i++) { const now = await p.evaluate(() => scrollY); if (now === y) break; y = now; await p.waitForTimeout(250); }
    // Touch reaches it too, and reading view has no garden to return to.
    await p.evaluate(() => { location.hash = 'wattch'; });
    await back.waitFor({ state: 'visible', timeout: 8000 });
    assert.ok((await back.boundingBox()).height >= 44, 'a touch-sized target');
    await p.goto(base + '/?view=read#wattch');
    assert.equal(await p.locator('.overview-return').isVisible(), false);
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});

/* Inside Whisperbook (OPTIMIZATION-PLAN.md, item 9). */
async function builtNote(p) {
  // The Whisperbook "What I built" note holds the steps.
  const note = p.locator('.chapter:has([data-inside="garden"])');
  await note.evaluate((e) => scrollTo({ top: e.offsetTop, behavior: 'instant' }));
  await p.locator('.chapter.active [data-inside="garden"]').waitFor({ state: 'visible' });
  return note;
}
const explaining = (p) => p.locator('#scene').getAttribute('data-explaining');

test('Inside Whisperbook steps from book to audio, lights the pavilion, and can be left at any step', async () => {
  const p = await bloom('/#whisperbook', {}, undefined, 0.6);
  try {
    const note = await builtNote(p);
    await note.getByRole('button', { name: 'Step inside' }).click();
    const current = note.locator('li[aria-current]');
    assert.match(await current.innerText(), /^Book/);
    assert.equal(await note.locator('.inside-steps li:visible').count(), 1);
    await p.waitForFunction(() => document.querySelector('#scene').dataset.explaining === '0');
    for (const title of ['Chapters', 'Voices', 'Audio']) {
      await note.getByRole('button', { name: 'Next' }).click();
      assert.match(await current.innerText(), new RegExp('^' + title));
    }
    // The scene publishes its explanation state on the next rendered frame.
    await p.waitForFunction(() => document.querySelector('#scene').dataset.explaining === '3');
    assert.equal(await explaining(p), '3');
    // From the voices on, the pavilion's rings sound.
    await p.waitForFunction(() => Number(document.querySelector('#scene').dataset.narrating) > 0.5);
    assert.equal(await note.getByRole('button', { name: 'Next' }).isVisible(), false, 'the last step');
    assert.equal(await note.locator('.inside-count').textContent(), 'Step 4 of 4');
    assert.ok(await note.getByRole('link', { name: /Read the source on GitHub/ }).isVisible(), 'evidence is a click away');
    await note.getByRole('button', { name: 'Back' }).click();
    await p.keyboard.press('Escape');
    await p.waitForFunction(() => document.querySelector('#scene').dataset.explaining === 'none');
    assert.equal(await p.evaluate(() => document.activeElement.textContent), 'Step inside', 'focus returns to where it began');
    // Leaving the note mid-way closes it.
    await note.getByRole('button', { name: 'Step inside' }).click();
    await p.locator('.chapter:has([data-inside="garden"]) + .chapter, .chapter:has([data-inside="garden"]) ~ .chapter').first()
      .evaluate((e) => scrollTo({ top: e.offsetTop, behavior: 'instant' }));
    await p.waitForFunction(() => document.querySelector('#scene').dataset.explaining === 'none');
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});

test('Inside Whisperbook reads as a whole on the page and with reduced motion, in every language', async () => {
  const p = await bloom('/#whisperbook', { reducedMotion: 'reduce' }, undefined, 0.6);
  try {
    const note = await builtNote(p);
    await note.getByRole('button', { name: 'Step inside' }).click();
    assert.equal(await note.locator('.inside-steps li:visible').count(), 4, 'all steps at once');
    assert.equal(await note.getByRole('button', { name: 'Next' }).isVisible(), false);
    await p.goto(base + '/?view=read#whisperbook');
    const page = p.locator('#whisperbook [data-inside="page"]');
    assert.equal(await page.locator('li').count(), 4);
    assert.equal(await page.locator('button').count(), 0, 'a plain list on the page');
    await p.goto(base + '/?view=read&lang=fr#whisperbook');
    await p.waitForFunction(() => document.documentElement.lang === 'fr');
    assert.equal(await p.locator('#inside-page-title').innerText(), 'Dans Whisperbook');
    assert.match(await page.locator('li').first().innerText(), /aucune permission réseau/);
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});
