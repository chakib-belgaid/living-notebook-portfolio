import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

/* The garden and sky loops run only while there is something to draw
   (OPTIMIZATION-PLAN.md, item 2). Callbacks are counted from the page's own
   requestAnimationFrame requests; hidden is simulated as in
   tests/performance.mjs. */
const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
let browser;
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => browser?.close());

function instrument() {
  const raf = window.requestAnimationFrame.bind(window);
  const p = window.__perf = { raf: 0, drawFrames: 0, tick: 0, seen: -1 };
  window.requestAnimationFrame = (cb) => { p.raf++; return raf(cb); };
  const probe = () => { p.tick++; raf(probe); };
  raf(probe);
  for (const proto of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype]) {
    if (!proto) continue;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const f = proto[name];
      if (f) proto[name] = function (...a) { if (p.seen !== p.tick) { p.seen = p.tick; p.drawFrames++; } return f.apply(this, a); };
    }
  }
  let hidden = false;
  Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  window.__setHidden = (h) => { hidden = h; document.dispatchEvent(new Event('visibilitychange')); };
}
async function garden(path = '/', options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const p = await context.newPage();
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(e.message));
  await p.route('**/*open-meteo.com/**', (r) => r.abort());
  await p.addInitScript(instrument);
  await p.goto(base + path);
  await p.waitForFunction(() => document.querySelector('#scene')?.dataset.progress);
  return p;
}
/* What the page asked for and drew over `ms`, from just before `act`. */
async function over(p, ms, act) {
  const start = await p.evaluate(() => ({ raf: window.__perf.raf, draws: window.__perf.drawFrames }));
  if (act) await act();
  await p.waitForTimeout(ms);
  const end = await p.evaluate(() => ({ raf: window.__perf.raf, draws: window.__perf.drawFrames }));
  return { raf: end.raf - start.raf, draws: end.draws - start.draws };
}
async function bloom(p) {
  await p.locator('.masthead a[href="#contact"]').click();
  await p.locator('.chapter.active .note-email a').waitFor({ state: 'visible', timeout: 8000 });
  await p.waitForFunction(() => Number(document.querySelector('#scene').dataset.progress) > 0.99);
}

test('a paused, settled garden and sky stop asking for frames, and wake for changes', async () => {
  const p = await garden('/#contact');
  try {
    await bloom(p);
    assert.ok((await over(p, 1000)).draws > 20, 'the living garden draws continuously');
    await p.getByRole('button', { name: 'Pause motion', exact: true }).click();
    await p.waitForTimeout(1500);
    const still = await over(p, 2000);
    assert.equal(still.draws, 0, 'no frames drawn while paused and settled');
    assert.ok(still.raf <= 2, `paused and settled: ${still.raf} frame requests in 2 s`);
    // A change while paused draws, then settles again.
    await p.locator('.dock > summary').click();
    const woke = await over(p, 1200);
    // A new hour is a single frame: count from before it is set.
    const changed = await over(p, 1200, () => p.locator('#hour').fill('21'));
    assert.ok(changed.draws > 0, 'a new hour is drawn while paused');
    await p.waitForTimeout(1500);
    assert.equal((await over(p, 1500)).draws, 0, 'and the garden settles again');
    assert.ok(woke.raf < 200);
    // Resuming brings the living garden back.
    await p.getByRole('button', { name: 'Resume motion', exact: true }).click();
    assert.ok((await over(p, 1000)).draws > 20, 'resumed garden draws again');
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});

test('a hidden tab stops the loops; showing it again resumes without a jump', async () => {
  const p = await garden('/#contact');
  try {
    await bloom(p);
    const before = Number(await p.locator('#scene').getAttribute('data-animation-time'));
    await p.evaluate(() => window.__setHidden(true));
    await p.waitForTimeout(300);
    const hidden = await over(p, 2000);
    assert.equal(hidden.draws, 0);
    assert.ok(hidden.raf <= 2, `hidden: ${hidden.raf} frame requests in 2 s`);
    await p.evaluate(() => window.__setHidden(false));
    const shown = await over(p, 800);
    assert.ok(shown.draws > 10, 'visible again: the garden draws');
    const after = Number(await p.locator('#scene').getAttribute('data-animation-time'));
    // 2.3 s hidden must not count as garden time: only the 0.8 s since.
    assert.ok(after - before < 1.6, `animation clock advanced ${(after - before).toFixed(2)} s`);
    assert.deepEqual(p.errors, []);
  } finally { await p.context().close(); }
});

test('the reading page schedules no recurring frames', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await context.newPage();
  try {
    await p.addInitScript(instrument);
    await p.goto(base + '/?view=read');
    await p.waitForTimeout(1500);
    assert.ok((await over(p, 2000)).raf <= 2);
    assert.equal(await p.locator('#scene canvas').count(), 0);
  } finally { await context.close(); }
});
