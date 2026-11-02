// P4 scene integration and lifecycle, against a production preview:
//   npm run build && npx vite preview --host 127.0.0.1 --port <port> --strictPort
//   TEST_URL=http://127.0.0.1:<port> node --test tests/scene-lifecycle.test.mjs
// Frame counts come from the page's own drawing totals (window.__notebookStats:
// garden and sky frames) and from WebGL draw calls grouped by animation frame,
// never from requestAnimationFrame probes alone. SwiftShader is slow: waits
// are for states, with generous timeouts, not for fixed frame rates.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { setupPage } from './browser-fixture.mjs';

const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
const performanceBudgets = process.env.PERFORMANCE_BUDGETS === '1';
const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };
const phoneOptions = { viewport: phone, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
let browser;
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) }); });
after(async () => browser?.close());

/** Installed before any page script: WebGL contexts and draw frames, audio
 * contexts, the first-frame rail poster, the garden's drawn progress, and a
 * controllable document.hidden. */
function instrument() {
  const raf = window.requestAnimationFrame.bind(window);
  const p = window.__probe = { raf: 0, tick: 0, seen: -1, drawFrames: 0, contexts: 0, audio: 0, audioResumes: 0, firstRailPoster: null, progress: [], drawn: [], liveAt: null };
  window.requestAnimationFrame = (cb) => { p.raf++; return raf(cb); };
  const tick = () => { p.tick++; raf(tick); };
  raf(tick);
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const known = this.__counted;
    const ctx = getContext.call(this, type, ...rest);
    if (ctx && /webgl/.test(type) && !known) { this.__counted = true; p.contexts++; }
    return ctx;
  };
  for (const proto of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype]) {
    if (!proto) continue;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const f = proto[name];
      if (f) proto[name] = function (...a) { if (p.seen !== p.tick) { p.seen = p.tick; p.drawFrames++; } return f.apply(this, a); };
    }
  }
  const Audio = window.AudioContext;
  if (Audio) {
    window.AudioContext = class extends Audio {
      constructor(...a) { super(...a); p.audio++; }
      resume() { p.audioResumes++; return super.resume(); }
    };
  }
  // The rail's poster as the first frame that includes it is about to paint.
  const firstRail = () => {
    const img = document.querySelector('[data-scene-host="rail"] img');
    if (img) p.firstRailPoster = img.getAttribute('src');
    else raf(firstRail);
  };
  raf(firstRail);
  // Every progress the garden draws, and the pose when the stage is revealed.
  new MutationObserver(records => {
    for (const r of records) {
      const el = r.target;
      if (r.attributeName === 'data-progress' && el.classList?.contains('scene-garden')) p.progress.push(Number(el.dataset.progress));
      if (r.attributeName === 'data-drawn' && el.classList?.contains('scene-garden')) p.drawn.push(Number(el.dataset.drawn));
      if (r.attributeName === 'data-live' && el.hasAttribute('data-live') && p.liveAt === null) {
        p.liveAt = { frames: window.__notebookStats?.().garden?.frames ?? 0, chapter: window.__notebookScene?.state().pose?.chapter ?? null, progress: Number(el.querySelector('.scene-garden')?.dataset.progress), drawn: Number(el.querySelector('.scene-garden')?.dataset.drawn) };
      }
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-progress', 'data-drawn', 'data-live'] });
  let hidden = false;
  Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  window.__setHidden = (h) => { hidden = h; document.dispatchEvent(new Event('visibilitychange')); };
}

async function open(path, { options = { viewport: desktop }, init, before: prepare } = {}) {
  return setupPage(browser, options, async p => {
    p.errors = [];
    p.sceneRequests = [];
    p.on('pageerror', e => p.errors.push(e.message));
    p.on('request', r => { if (/\/assets\/(scene|sky|scene-adapter)-[\w-]+\.js$/.test(r.url())) p.sceneRequests.push(r.url()); });
    await p.addInitScript(instrument);
    if (init) await p.addInitScript(init);
    if (prepare) await prepare(p);
    await p.goto(base + path);
    await p.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
  });
}
const close = p => p.context().close();
const scene = p => p.evaluate(() => window.__notebookScene.state());
const stats = p => p.evaluate(() => window.__notebookStats());
const probe = p => p.evaluate(() => window.__probe);
const live = (p, timeout = 60000) => p.waitForFunction(() => window.__notebookScene.state().live, null, { timeout });
/** Settled on `chapter` (and held, in guided normal motion). */
const settledOn = (p, chapter, timeout = 60000) => p.waitForFunction(c => {
  const s = window.__notebookScene.state();
  return s.live && s.chapter === c && s.transition === 1 && s.settled;
}, chapter, { timeout });
/** Garden frames, sky frames and WebGL draw frames over `ms`. */
async function over(p, ms) {
  const a = await p.evaluate(() => ({ s: window.__notebookStats(), d: window.__probe.drawFrames }));
  await p.waitForTimeout(ms);
  const b = await p.evaluate(() => ({ s: window.__notebookStats(), d: window.__probe.drawFrames }));
  return { garden: b.s.garden.frames - a.s.garden.frames, sky: b.s.sky.frames - a.s.sky.frames, draws: b.d - a.d };
}
const openControls = async p => {
  if (await p.locator('#scene-panel').isHidden()) await p.locator('.scene-toggle').click();
};
const control = (p, name) => p.locator(`[data-scene-control="${name}"]`);

test('desktop: one renderer and one canvas across chapter and layout changes', async () => {
  const p = await open('/');
  try {
    await live(p);
    const first = await p.evaluate(() => { const c = document.querySelector('.scene-garden canvas'); c.__marked = true; return document.querySelectorAll('canvas').length; });
    assert.equal(first, 3, 'the garden canvas and the two sky layers');
    for (const href of ['#work', '#about', '#contact']) {
      await p.locator(`.nav-sections a[href="${href}"]`).click();
      await settledOn(p, href.slice(1));
    }
    // Wide → portrait → wide: the same stage and canvas move between hosts.
    await p.setViewportSize(phone);
    await p.waitForFunction(() => window.__notebookScene.state().host !== 'rail');
    const portrait = await p.evaluate(() => ({ host: window.__notebookScene.state().host, inSlot: !!document.querySelector('.chapter [data-scene-host] > .scene-stage') }));
    assert.equal(portrait.inSlot, true, 'the stage is in a chapter slot on portrait');
    await p.setViewportSize(desktop);
    await p.waitForFunction(() => window.__notebookScene.state().host === 'rail');
    const end = await p.evaluate(() => ({
      canvases: document.querySelectorAll('canvas').length,
      stages: document.querySelectorAll('.scene-stage').length,
      same: document.querySelector('.scene-garden canvas').__marked === true,
      contexts: window.__probe.contexts,
    }));
    assert.deepEqual(end, { canvases: 3, stages: 1, same: true, contexts: 1 });
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

test('phone: the stage moves between chapter slots, one canvas, and the slice round trip keeps it', async () => {
  const p = await open('/', { options: phoneOptions });
  try {
    await live(p);
    assert.equal((await scene(p)).host, 'intro');
    // Read on with the finger: the wheel stands in for touch scrolling.
    for (let i = 0; i < 30 && (await scene(p)).chapter === 'intro'; i++) { await p.mouse.wheel(0, 300); await p.waitForTimeout(120); }
    await p.waitForFunction(() => window.__notebookScene.state().host === 'work', null, { timeout: 20000 });
    await p.locator('.nav-sections a[href="#work"]').click();
    await p.locator('.work-index a[href="#whisperbook"]').click();
    await settledOn(p, 'whisperbook');
    assert.equal((await scene(p)).host, 'whisperbook');
    // The Android case round trip lands back on Whisperbook with the scene there.
    await p.locator('#whisperbook a[href*="/work/whispbook/"]').first().click();
    await p.waitForURL(/\/work\/whispbook\//);
    await p.locator('a', { hasText: 'Return to the portfolio' }).first().click();
    await p.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
    await settledOn(p, 'whisperbook');
    const s = await scene(p);
    assert.equal(s.host, 'whisperbook');
    assert.equal(await p.evaluate(() => document.querySelectorAll('.scene-stage').length), 1);
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

for (const [path, chapter, poster, progress] of [['/#whisperbook', 'whisperbook', 'whisperbook', 0.66], ['/', 'intro', 'sketch', 0]]) {
  test(`${path}: the poster stays until the complete ${chapter} pose is drawn`, async () => {
    let release;
    const gate = new Promise(r => { release = r; });
    const p = await open(path, {
      before: page => page.route(/\/assets\/scene-[\w-]+\.js$/, async route => { await gate; await route.continue(); }),
    });
    try {
      await p.waitForTimeout(1500);
      const waiting = await p.evaluate(() => {
        const host = document.querySelector('.scene-stage')?.parentElement ?? document.querySelector('[data-scene-host="rail"]');
        const stage = host.querySelector('.scene-stage');
        return { renderer: document.documentElement.dataset.renderer, poster: document.querySelector('[data-scene-host="rail"] img').getAttribute('src'), stageLive: stage?.hasAttribute('data-live') ?? false, stageVisible: stage ? getComputedStyle(stage).visibility : 'none' };
      });
      assert.equal(waiting.renderer, 'loading');
      assert.match(waiting.poster, new RegExp(`${poster}\\.webp$`));
      assert.equal(waiting.stageLive, false);
      assert.notEqual(waiting.stageVisible, 'visible', 'nothing covers the poster while loading');
      release();
      await live(p);
      const pr = await probe(p);
      assert.ok(pr.liveAt.frames >= 1, 'revealed only after a frame was drawn');
      assert.equal(pr.liveAt.chapter, chapter);
      assert.equal(pr.liveAt.progress.toFixed(2), progress.toFixed(2), 'the first visible frame is the destination pose');
      assert.equal(pr.liveAt.drawn, 1, 'the drawing is complete when it replaces the poster');
      assert.ok(pr.drawn.length > 0 && pr.drawn.every(v => v === 1), `no partly drawn frame: ${[...new Set(pr.drawn)].join(', ')}`);
      assert.deepEqual(p.errors, []);
    } finally { release(); await close(p); }
  });
}

test('a reload of /#contact restores Contact: bloom poster first, only Contact drawn', async () => {
  const p = await open('/#contact');
  try {
    await settledOn(p, 'contact');
    await p.locator('#contact').hover();
    await p.mouse.wheel(0, -120);
    await p.waitForTimeout(400);
    assert.equal(await p.evaluate(() => location.hash), '#contact');
    await p.reload();
    await p.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
    await live(p);
    const pr = await probe(p);
    assert.match(pr.firstRailPoster, /bloom\.webp$/, `first painted rail poster after reload: ${pr.firstRailPoster}`);
    assert.ok(pr.progress.length > 0 && pr.progress.every(v => v > 0.99), `drawn after reload: ${[...new Set(pr.progress)].join(', ')}`);
    assert.equal((await scene(p)).chapter, 'contact');
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

test('a fragment reload left at the top (no scroll restored) ends on the opening', async () => {
  const p = await open('/#contact', { init: () => { history.scrollRestoration = 'manual'; } });
  try {
    await settledOn(p, 'contact');
    await p.reload();
    await p.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
    assert.equal(await p.evaluate(() => scrollY), 0, 'no restored scroll');
    await settledOn(p, 'intro');
    assert.match(await p.evaluate(() => document.querySelector('[data-scene-host="rail"] img').getAttribute('src')), /sketch\.webp$/);
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

test('turning still images on and off again while the scene loads ends with a live stage', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const p = await open('/', { before: page => page.route(/\/assets\/scene-[\w-]+\.js$/, async route => { await gate; await route.continue(); }) });
  try {
    await p.waitForFunction(() => document.documentElement.dataset.renderer === 'loading');
    await openControls(p);
    await control(p, 'stills').click();
    assert.equal(await p.evaluate(() => document.documentElement.dataset.renderer), 'not-requested');
    await control(p, 'stills').click();
    assert.equal(await p.evaluate(() => document.documentElement.dataset.renderer), 'loading');
    release();
    await live(p);
    assert.equal(await p.evaluate(() => document.querySelectorAll('.scene-stage').length), 1);
    assert.equal(await p.evaluate(() => window.__probe.contexts), 1, 'the torn-down load built nothing');
    assert.deepEqual(p.errors, []);
  } finally { release(); await close(p); }
});

for (const [path, poster, progress] of [['/#contact', 'bloom', 1], ['/?lang=fr#whisperbook', 'whisperbook', 0.66], ['/#wattch', 'wattch', 0.76]]) {
  test(`deep link ${path}: the first paint shows the ${poster} poster and the scene never draws the sketch`, async () => {
    const p = await open(path);
    try {
      const first = (await probe(p)).firstRailPoster;
      assert.match(first, new RegExp(`${poster}\\.webp$`), `first painted rail poster: ${first}`);
      await live(p);
      const drawn = (await probe(p)).progress;
      assert.ok(drawn.length > 0);
      assert.ok(drawn.every(v => Math.abs(v - progress) < 0.005), `every drawn frame at ${progress}: ${[...new Set(drawn)].join(', ')}`);
      assert.deepEqual(p.errors, []);
    } finally { await close(p); }
  });
}

test('a reading hold draws no garden or sky frames once settled (desktop Contact, Bloom)', async t => {
  const p = await open('/#mcq-scan');
  try {
    await settledOn(p, 'mcq-scan');
    // A passive transition: the visitor reads on into About and Contact.
    await p.locator('#mcq-scan').hover();
    for (let i = 0; i < 60 && (await scene(p)).chapter !== 'contact'; i++) { await p.mouse.wheel(0, 400); await p.waitForTimeout(80); }
    await settledOn(p, 'contact');
    await p.waitForTimeout(300);
    const held = await over(p, 5000);
    t.diagnostic(`held at Contact for 5 s: ${JSON.stringify(held)}`);
    assert.deepEqual(held, { garden: 0, sky: 0, draws: 0 });
    assert.equal((await scene(p)).held, true);
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

test('phone: a reading hold at Whisperbook draws no garden or sky frames', async t => {
  const p = await open('/#bplog', { options: phoneOptions });
  try {
    await settledOn(p, 'bplog');
    for (let i = 0; i < 60 && (await scene(p)).chapter !== 'whisperbook'; i++) { await p.mouse.wheel(0, 250); await p.waitForTimeout(80); }
    await settledOn(p, 'whisperbook');
    await p.waitForTimeout(300);
    const held = await over(p, 5000);
    t.diagnostic(`held at Whisperbook (phone) for 5 s: ${JSON.stringify(held)}`);
    assert.deepEqual(held, { garden: 0, sky: 0, draws: 0 });
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

test('rapid and reverse scrolling resolve directly to the latest chapter, nothing queued', async t => {
  const p = await open('/#work');
  try {
    await settledOn(p, 'work');
    const before = (await scene(p)).settles;
    // Five chapters in well under a settle's time.
    await p.locator('#work').hover();
    for (let i = 0; i < 40 && (await scene(p)).chapter !== 'about'; i++) await p.mouse.wheel(0, 500);
    await settledOn(p, 'about');
    const forward = (await scene(p)).settles - before;
    t.diagnostic(`settles for work → about: ${forward}`);
    assert.equal(forward, 1, 'one settle, at the destination');
    // Reverse: back up to BP Log; the build only goes down, it never replays the chapters between.
    await p.evaluate(() => { window.__probe.progress = []; });
    for (let i = 0; i < 40 && (await scene(p)).chapter !== 'bplog'; i++) await p.mouse.wheel(0, -500);
    await settledOn(p, 'bplog');
    const drawn = (await probe(p)).progress;
    assert.ok(drawn.every((v, i) => i === 0 || v <= drawn[i - 1] + 0.0005), `monotonic: ${drawn.slice(0, 12).join(', ')}…`);
    assert.ok(Math.abs(drawn.at(-1) - 0.52) < 0.005);
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

test('a hidden tab stops all drawing; on return the latest chapter is posed at once', async t => {
  const p = await open('/#bplog');
  try {
    await settledOn(p, 'bplog');
    // Read on: a passive transition toward Whisperbook starts, then the tab is hidden.
    await p.locator('#bplog').hover();
    for (let i = 0; i < 60 && (await scene(p)).chapter === 'bplog'; i++) { await p.mouse.wheel(0, 200); await p.waitForTimeout(60); }
    await p.evaluate(() => window.__setHidden(true));
    await p.waitForTimeout(300);
    const hidden = await over(p, 2000);
    t.diagnostic(`hidden: ${JSON.stringify(hidden)}`);
    assert.deepEqual(hidden, { garden: 0, sky: 0, draws: 0 });
    // While hidden, the visitor's place moves on (a history traversal lands on Contact).
    await p.evaluate(() => { history.pushState(null, '', '#contact'); dispatchEvent(new PopStateEvent('popstate')); });
    await p.waitForTimeout(500);
    assert.equal((await over(p, 500)).garden, 0, 'still nothing drawn while hidden');
    await p.evaluate(() => { window.__probe.progress = []; window.__setHidden(false); });
    await settledOn(p, 'contact');
    const drawn = (await probe(p)).progress;
    assert.ok(drawn.length > 0 && drawn.every(v => v > 0.99), `the first frames after return are Contact: ${[...new Set(drawn)].join(', ')}`);
    const shown = await over(p, 1500);
    t.diagnostic(`shown again, then held: ${JSON.stringify(shown)}`);
    assert.deepEqual(shown, { garden: 0, sky: 0, draws: 0 });
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

test('context loss shows the still and keeps links; the restored renderer never shows an earlier pose', async () => {
  const p = await open('/#contact');
  try {
    await settledOn(p, 'contact');
    await p.evaluate(() => { window.__lose = document.querySelector('.scene-garden canvas').getContext('webgl2').getExtension('WEBGL_lose_context'); window.__lose.loseContext(); });
    await p.waitForFunction(() => document.documentElement.dataset.renderer === 'context-lost');
    const lost = await p.evaluate(() => {
      const rail = document.querySelector('[data-scene-host="rail"]');
      return { poster: rail.querySelector('img').getAttribute('src'), stage: getComputedStyle(rail.querySelector('.scene-stage')).visibility };
    });
    assert.match(lost.poster, /bloom\.webp$/);
    assert.equal(lost.stage, 'hidden', 'the matching still shows');
    // Text and links still work.
    await p.locator('.nav-sections a[href="#about"]').click();
    assert.equal(await p.evaluate(() => location.hash), '#about');
    await p.locator('.nav-sections a[href="#contact"]').click();
    await p.evaluate(() => { window.__probe.progress = []; window.__lose.restoreContext(); });
    await p.waitForFunction(() => document.documentElement.dataset.renderer === 'ready' && window.__notebookScene.state().live, null, { timeout: 60000 });
    const drawn = (await probe(p)).progress;
    assert.ok(drawn.length > 0 && drawn.every(v => v > 0.99), `after restore only Contact is drawn: ${[...new Set(drawn)].join(', ')}`);
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

for (const [label, path, options] of [
  ['system reduced motion', '/', { viewport: desktop, reducedMotion: 'reduce' }],
  ['?view=stills', '/?view=stills', { viewport: desktop }],
  ['?view=read', '/?view=read#whisperbook', phoneOptions],
]) {
  test(`${label} loads no scene until the visitor asks`, async () => {
    const p = await open(path, { options });
    try {
      await p.waitForTimeout(2500);
      assert.deepEqual(p.sceneRequests, [], 'no scene module requested');
      assert.equal(await p.locator('canvas').count(), 0);
      assert.equal(await p.evaluate(() => document.documentElement.dataset.renderer), 'not-requested');
      await openControls(p);
      assert.equal(await control(p, 'stills').getAttribute('aria-pressed'), 'true');
      await control(p, 'stills').click();
      await live(p);
      assert.equal(await control(p, 'stills').getAttribute('aria-pressed'), 'false');
      if (options.reducedMotion) {
        const s = await scene(p);
        assert.equal(s.motion, 'system-reduced');
        // Still preference: an explicit jump lands in one drawn frame.
        await p.locator('.nav-sections a[href="#contact"]').click();
        await settledOn(p, 'contact');
        assert.deepEqual(await over(p, 2000), { garden: 0, sky: 0, draws: 0 });
      }
      assert.deepEqual(p.errors, []);
    } finally { await close(p); }
  });
}

test('save-data prefers the stills until asked', async () => {
  const p = await open('/', { init: () => Object.defineProperty(Navigator.prototype, 'connection', { configurable: true, get: () => ({ saveData: true, addEventListener() {} }) }) });
  try {
    await p.waitForTimeout(2500);
    assert.deepEqual(p.sceneRequests, []);
    await openControls(p);
    assert.match(await p.locator('[data-scene-status]').textContent(), /Data saver/);
    await control(p, 'stills').click();
    await live(p);
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

test('stills on a wide layout: the rail poster follows the chapter', async () => {
  const p = await open('/?view=stills');
  try {
    await p.locator('.nav-sections a[href="#contact"]').click();
    await p.waitForFunction(() => /bloom\.webp$/.test(document.querySelector('[data-scene-host="rail"] img').getAttribute('src')));
    await p.locator('.work-index a[href="#energy-tools"]').evaluate(a => a.click());
    await p.waitForFunction(() => /wattch\.webp$/.test(document.querySelector('[data-scene-host="rail"] img').getAttribute('src')));
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

test('sound starts only from its own control (F21)', async () => {
  const p = await open('/');
  try {
    await live(p);
    // Work, CV and Contact clicks, ordinary keys and scrolling.
    await p.evaluate(() => document.addEventListener('click', e => { if (e.target.closest('a[href$=".pdf"], a[href^="mailto:"]')) e.preventDefault(); }));
    await p.locator('.nav-sections a[href="#work"]').click();
    await p.locator('.cv-link').click();
    await p.locator('.nav-sections a[href="#contact"]').click();
    await p.locator('#contact a[href^="mailto:"]').first().click();
    await p.keyboard.press('Tab');
    await p.keyboard.press('ArrowUp');
    await p.keyboard.press('Space');
    await p.keyboard.press('Home');
    await p.mouse.wheel(0, 800);
    await p.waitForTimeout(500);
    let pr = await probe(p);
    assert.equal(pr.audio, 0, 'no audio context created');
    assert.equal(pr.audioResumes, 0);
    assert.equal((await scene(p)).sound, false);
    await openControls(p);
    await control(p, 'sound').click();
    await p.waitForFunction(() => window.__probe.audio === 1);
    assert.equal(await control(p, 'sound').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});

test('pause is independent of sound consent and of pose selection (F22)', async () => {
  const p = await open('/#work');
  try {
    await settledOn(p, 'work');
    await openControls(p);
    await control(p, 'sound').click();
    await control(p, 'pause').click();
    let s = await scene(p);
    assert.equal(s.motion, 'user-paused');
    assert.equal(s.sound, true, 'pausing keeps sound consent');
    assert.equal(await control(p, 'sound').getAttribute('aria-pressed'), 'true');
    // Paused, navigation still establishes the next static pose.
    await p.locator('.nav-sections a[href="#contact"]').click();
    await settledOn(p, 'contact');
    assert.equal((await scene(p)).pose.progress, 1);
    assert.deepEqual(await over(p, 2000), { garden: 0, sky: 0, draws: 0 });
    // Sound off does not resume motion; resuming motion does not change sound.
    await openControls(p);
    await control(p, 'sound').click();
    assert.equal((await scene(p)).motion, 'user-paused');
    await control(p, 'pause').click();
    s = await scene(p);
    assert.equal(s.motion, 'normal');
    assert.equal(s.sound, false);
    assert.deepEqual(p.errors, []);
  } finally { await close(p); }
});
