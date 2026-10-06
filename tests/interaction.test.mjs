import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

/* Feedback for the visitor's actions (OPTIMIZATION-PLAN.md, items 7 and 8). */
const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
let browser;
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => browser?.close());

async function bloom(path = '/#contact', options = {}, init, grown = 0.99) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const p = await context.newPage();
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  await p.route('**/*open-meteo.com/**', (r) => r.abort());
  if (init) await p.addInitScript(init);
  await p.goto(base + path);
  await p.waitForFunction((grown) => Number(document.querySelector('#scene')?.dataset.progress) > grown, grown, { timeout: 15000 });
  return p;
}
const hover = (p) => p.locator('#scene').getAttribute('data-hover');
/* Milliseconds from an event on the label to the garden's answer. */
const answerTime = (p, spot, type) => p.evaluate(([spot, type]) => new Promise((resolve) => {
  const scene = document.querySelector('#scene');
  const label = document.querySelector(`.hotspot[data-spot="${spot}"]`);
  const start = performance.now();
  new MutationObserver((_, o) => { if (scene.dataset.hover === spot) { o.disconnect(); resolve(performance.now() - start); } })
    .observe(scene, { attributes: true, attributeFilter: ['data-hover'] });
  if (type === 'focus') label.querySelector('a').focus();
  else label.dispatchEvent(new PointerEvent('pointerenter'));
}), [spot, type]);

test('a building answers its label pointed at or focused, within 100 ms', async () => {
  const p = await bloom();
  try {
    await p.locator('.hotspot[data-spot="whisperbook"]').hover();
    await p.waitForFunction(() => document.querySelector('#scene').dataset.hover === 'whisperbook');
    await p.mouse.move(5, 450);
    await p.waitForFunction(() => document.querySelector('#scene').dataset.hover === 'none');
    assert.ok(await answerTime(p, 'wattch', 'pointer') < 100);
    await p.evaluate(() => document.querySelector('.hotspot[data-spot="wattch"]').dispatchEvent(new PointerEvent('pointerleave')));
    await p.waitForFunction(() => document.querySelector('#scene').dataset.hover === 'none');
    // The keyboard gets the same answer, and leaving clears it.
    assert.ok(await answerTime(p, 'contact', 'focus') < 100);
    assert.equal(await p.locator('.hotspot[data-spot="contact"] a').evaluate((a) => getComputedStyle(a.parentElement).backgroundColor !== 'rgba(0, 0, 0, 0)'), true);
    await p.keyboard.press('Shift+Tab');
    await p.waitForFunction(() => document.querySelector('#scene').dataset.hover !== 'contact');
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

function countTones() {
  window.tones = [];
  const create = AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator = function () { const o = create.call(this); window.tones.push(o); return o; };
}
const chimes = (p) => p.evaluate(() => window.tones.filter((o) => Math.abs(o.frequency.value - 783.99) < 0.5).length);

test('planting chimes only while the garden is heard', async () => {
  const p = await bloom('/#contact', {}, countTones);
  try {
    await p.keyboard.press('Shift');
    await p.waitForFunction(() => document.documentElement.dataset.sound === 'playing');
    await p.locator('.dock > summary').click();
    await p.locator('#plant-one').click();
    await p.waitForFunction(() => window.tones.some((o) => Math.abs(o.frequency.value - 783.99) < 0.5));
    const heard = await chimes(p);
    await p.getByRole('button', { name: 'Stop garden sounds', exact: true }).click();
    await p.locator('#plant-one').click();
    await p.waitForTimeout(300);
    assert.equal(await chimes(p), heard, 'muted: no chime');
    await p.getByRole('button', { name: 'Play garden sounds', exact: true }).click();
    await p.getByRole('button', { name: 'Pause motion', exact: true }).click();
    await p.locator('#plant-one').click();
    await p.waitForTimeout(300);
    assert.equal(await chimes(p), heard, 'paused: no chime');
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});

function longTasks() {
  window.longtasks = [];
  new PerformanceObserver((l) => window.longtasks.push(...l.getEntries().map((e) => e.duration))).observe({ type: 'longtask', buffered: true });
}

test('a fennec visits a new tree, settles under it, and goes back to its day', async () => {
  const p = await bloom('/#contact', {}, longTasks);
  try {
    const phases = [];
    await p.exposeFunction('visitor', (v) => phases.push(v));
    await p.evaluate(() => new MutationObserver(() => window.visitor(document.querySelector('#scene').dataset.visitor))
      .observe(document.querySelector('#scene'), { attributes: true, attributeFilter: ['data-visitor'] }));
    await p.locator('.dock > summary').click();
    await p.evaluate(() => { window.longtasks = []; });
    for (let i = 0; i < 8 && !phases.length; i++) { await p.locator('#plant-one').click(); await p.waitForTimeout(400); }
    assert.equal(phases[0], 'notice', 'a fennec notices one of the new trees');
    await p.waitForFunction(() => document.querySelector('#scene').dataset.visitor === 'none', {}, { timeout: 20000 });
    assert.deepEqual(phases.filter((v, i) => v !== phases[i - 1]), ['notice', 'approach', 'settle', 'none']);
    assert.ok(Math.max(0, ...await p.evaluate(() => window.longtasks)) < 100, 'no stall while the fennec finds its way');
    // Not again straight away, and never while paused.
    await p.getByRole('button', { name: 'Pause motion', exact: true }).click();
    await p.locator('#plant-one').click();
    await p.waitForTimeout(500);
    assert.equal(phases.at(-1), 'none');
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});

test('reduced motion: the label answers at once, and no fennec walks over', async () => {
  const p = await bloom('/#contact', { reducedMotion: 'reduce' });
  try {
    assert.ok(await answerTime(p, 'whisperbook', 'pointer') < 100);
    await p.locator('.dock > summary').click();
    for (let i = 0; i < 4; i++) await p.locator('#plant-one').click();
    await p.waitForTimeout(800);
    assert.equal(await p.locator('#scene').getAttribute('data-visitor'), null);
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});
