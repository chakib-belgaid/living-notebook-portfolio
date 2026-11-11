/* Performance harness for the current page (product decisions 50, 72, 73),
   against a production preview:
     npx vite build --outDir <dir> && npx vite preview --outDir <dir> --host 127.0.0.1 --port <port> --strictPort
     TEST_URL=http://127.0.0.1:<port> node tests/performance.mjs
   PERFORMANCE_BUDGETS=1 makes a failed budget (or a scenario that could not
   be measured) exit non-zero; otherwise the run only reports. SCENARIOS
   limits the set, e.g. SCENARIOS=place-response,exploring. TRIALS (default
   5) is the number of hover and focus trials per place-response mode.

   Scenarios and budgets (desktop 1440×900 unless stated):
     place-response  (a) a place label (button.hotspot) while exploring,
                     reached by the pointer (hover()), from script (focus())
                     and by the keyboard (Tab from the previous place): from
                     the input event's timestamp to the end of the first
                     garden frame drawn with that place's highlight (the
                     garden's data-hover attribute), in normal and in reduced
                     motion. Budget: every trial < 100 ms.
     exploring       (b) garden frames per second while exploring (ambient
                     life on), and again after pause and resume: > 20 fps.
                     (c) garden frames in the 0.8 s after a hidden tab is
                     shown while exploring: > 10.
                     (d) longest main-thread task during a drag turn while
                     exploring: < 100 ms.
                     (e) ambient motion continues after leaving exploration:
                     garden frames continue over 3 s.
     fennec-visit    (d) longest main-thread task from planting a tree at
                     #contact in daylight (hour 13) to the end of the fennec's
                     visit: < 100 ms.
     first-pose      (f) deep links /#whisperbook and /#contact on desktop and
                     phone: navigation to scene request, construction, first
                     render, the reveal of the live stage and the end of the
                     task it happened in (when that frame can reach the
                     screen). Report only.

   Frames are the garden's own drawing totals (window.__notebookStats), with
   WebGL draw calls on the garden canvas grouped by animation frame for the
   intervals. Long tasks come from the Long Tasks API (tasks of 50 ms or
   more). A hidden tab is simulated (document.hidden overridden and
   visibilitychange fired), which measures what the page schedules. Live
   weather (Open-Meteo) is blocked. The report names the browser, its
   version, navigator.hardwareConcurrency, the unmasked WebGL renderer (a
   SwiftShader or other software renderer is flagged) and the viewports, so a
   run is a documented profile (decision 72). No battery or energy claim is
   made from these numbers (decision 50).

   Output: the JSON report on stdout and in .qa/performance/report.json;
   progress lines on stderr. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { waitForSceneSettled } from './browser-fixture.mjs';

const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
const enforce = process.env.PERFORMANCE_BUDGETS === '1';
const only = process.env.SCENARIOS?.split(',').map(s => s.trim()).filter(Boolean);
const TRIALS = Number(process.env.TRIALS || 5);
const outDir = fileURLToPath(new URL('../.qa/performance/', import.meta.url));
const READY_TIMEOUT = 90000;
// SwiftShader draws slowly and the scene's step is capped per frame, so a
// visit of about ten simulated seconds can take minutes of wall time.
const VISIT_TIMEOUT = 240000;

const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const log = (...a) => console.error('[performance]', ...a);
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });

/* Installed before any page script: garden draw frames (WebGL draw calls on
   the garden's canvas, grouped by animation frame), long tasks, place input
   timestamps, the garden's hover highlight as drawn, the reveal of the live
   stage, and a controllable document.hidden. */
function instrument() {
  const raf = window.requestAnimationFrame.bind(window);
  const p = window.__perf = { tick: 0, seen: -1, gardenFrames: 0, frameTimes: [], sampling: false, longtasks: [], inputs: [], hovers: [], liveAt: null };
  const tick = () => { p.tick++; raf(tick); };
  raf(tick);
  for (const proto of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype]) {
    if (!proto) continue;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const f = proto[name];
      if (!f) continue;
      proto[name] = function (...a) {
        if (this.__garden !== true) this.__garden = !!this.canvas?.closest?.('.scene-garden');
        if (this.__garden && p.seen !== p.tick) {
          p.seen = p.tick; p.gardenFrames++;
          if (p.sampling) p.frameTimes.push(performance.now());
        }
        return f.apply(this, a);
      };
    }
  }
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) p.longtasks.push({ start: e.startTime, ms: e.duration }); }).observe({ type: 'longtask', buffered: true });
  } catch { p.longtasks = null; }
  const spotOf = e => e.target?.closest?.('.hotspot[data-spot]')?.dataset.spot ?? null;
  document.addEventListener('pointerover', e => { const s = spotOf(e); if (s) p.inputs.push({ kind: 'pointer', spot: s, t: e.timeStamp }); }, true);
  document.addEventListener('focusin', e => { const s = spotOf(e); if (s) p.inputs.push({ kind: 'focus', spot: s, t: e.timeStamp }); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Tab') p.inputs.push({ kind: 'key', spot: null, t: e.timeStamp }); }, true);
  new MutationObserver(records => {
    const t = performance.now();
    for (const r of records) {
      const el = r.target;
      if (r.attributeName === 'data-hover') p.hovers.push({ t, value: el.dataset.hover });
      if (r.attributeName === 'data-live' && el.hasAttribute('data-live') && p.liveAt === null) {
        const pose = window.__notebookScene?.state().pose;
        p.liveAt = { t, chapter: pose?.chapter ?? null, progress: pose?.progress ?? null, frames: window.__notebookStats?.().garden?.frames ?? null };
      }
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-hover', 'data-live'] });
  let hidden = false;
  Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  window.__setHidden = h => { hidden = h; document.dispatchEvent(new Event('visibilitychange')); };
}

const round = (n, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const quantile = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : null; };

async function open(options, path) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  await page.route('**/*open-meteo.com/**', r => r.abort());
  await page.addInitScript(instrument);
  await page.goto(base + path);
  await page.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
  return page;
}
const close = p => p.context().close();
const ready = (p, timeout = READY_TIMEOUT) => p.waitForFunction(() => document.documentElement.dataset.renderer === 'ready' && window.__notebookScene.state().live, null, { timeout });
const frames = p => p.evaluate(() => window.__notebookStats().garden.frames);
const sceneState = p => p.evaluate(() => {
  const s = window.__notebookScene.state();
  return { chapter: s.chapter, quality: s.quality, detail: s.detail, motion: s.motion, exploring: s.exploring, settled: s.settled, host: s.host };
});
/** Waits until the garden has drawn nothing for 500 ms; false if it never does. */
async function asleep(p, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const a = await frames(p);
    await p.waitForTimeout(500);
    if (await frames(p) === a) return true;
  }
  return false;
}
async function enter(p) {
  if (!await p.evaluate(() => document.querySelector('.garden').open)) await p.locator('.garden > summary').click();
  await p.locator('[data-explore]').click();
  await p.waitForFunction(() => document.documentElement.dataset.explore === 'true');
}

/** One measured window: garden and sky frames, frame intervals, long tasks. */
async function measure(p, ms, act) {
  await p.evaluate(() => {
    const P = window.__perf;
    P.frameTimes = []; P.sampling = true;
    const s = window.__notebookStats();
    P.mark = { t: performance.now(), garden: s.garden.frames, sky: s.sky?.frames ?? 0, cpu: s.garden.cpuMs, tasks: P.longtasks?.length ?? 0 };
  });
  if (act) await act();
  await p.waitForTimeout(ms);
  const r = await p.evaluate(() => {
    const P = window.__perf; P.sampling = false;
    const s = window.__notebookStats();
    const t = performance.now();
    return {
      seconds: (t - P.mark.t) / 1000,
      garden: s.garden.frames - P.mark.garden, sky: (s.sky?.frames ?? 0) - P.mark.sky,
      cpuMs: s.garden.cpuMs - P.mark.cpu,
      times: P.frameTimes,
      tasks: P.longtasks ? P.longtasks.slice(P.mark.tasks).filter(e => e.start >= P.mark.t - 1) : null,
    };
  });
  const iv = r.times.slice(1).map((t, i) => t - r.times[i]);
  return {
    seconds: round(r.seconds, 2),
    gardenFrames: r.garden, skyFrames: r.sky,
    fps: round(r.garden / r.seconds),
    frameIntervalP50Ms: round(quantile(iv, 0.5)), frameIntervalP95Ms: round(quantile(iv, 0.95)),
    cpuMsPerFrame: r.garden ? round(r.cpuMs / r.garden, 2) : null,
    longTasks: r.tasks === null ? 'unavailable' : r.tasks.length,
    maxTaskMs: r.tasks === null ? null : round(Math.max(0, ...r.tasks.map(e => e.ms))),
  };
}

const budgets = [];
function budget(id, measured, limit, pass, extra = {}) {
  budgets.push({ id, budget: limit, measured, pass, ...extra });
  log(`${pass ? 'pass' : 'FAIL'} ${id}: ${measured} (budget ${limit})`);
}

/* (a) A place's highlight answers its hover or focus within 100 ms. */
async function placeResponse() {
  const out = {};
  for (const motion of ['normal', 'reduced']) {
    const reduced = motion === 'reduced';
    const p = await open({ ...desktop, reducedMotion: reduced ? 'reduce' : 'no-preference' }, '/#whisperbook');
    try {
      if (reduced) await p.waitForFunction(() => document.documentElement.dataset.renderer === 'not-requested');
      else await ready(p);
      await enter(p);
      await ready(p);
      await p.waitForTimeout(1000);
      if (reduced) await asleep(p);
      const spots = await p.evaluate(() => [...document.querySelectorAll('.hotspot')].filter(h => !h.hidden && h.getBoundingClientRect().width > 0).map(h => h.dataset.spot));
      if (!spots.length) throw new Error('no place is visible while exploring');
      const trials = { pointer: [], focus: [], keyboard: [] };
      /** Input timestamp of `kind` on `spot` after `since` to the end of the first frame drawn with it highlighted. */
      const response = (kind, spot, since) => p.waitForFunction(({ spot, since, kind }) => {
        const P = window.__perf;
        const input = P.inputs.find(e => e.kind === kind && (kind === 'key' || e.spot === spot) && e.t >= since);
        const drawn = input && P.hovers.find(h => h.value === spot && h.t >= input.t);
        return drawn ? drawn.t - input.t : null;
      }, { spot, since, kind }, { timeout: 20000 }).then(h => h.jsonValue());
      const drawnAway = async () => {
        await p.waitForFunction(() => document.querySelector('[data-hover]')?.dataset.hover === 'none', null, { timeout: 20000 });
        if (reduced) await asleep(p, 10);
        else await p.waitForTimeout(200);
      };
      const now = () => p.evaluate(() => performance.now());
      for (let i = 0; i < TRIALS; i++) {
        // Pointer: the mouse moves onto the label (Playwright hover()).
        const spot = spots[i % spots.length];
        let since = await now();
        await p.locator(`.hotspot[data-spot="${spot}"]`).hover();
        trials.pointer.push(round(await response('pointer', spot, since)));
        await p.mouse.move(4, 450);
        await drawnAway();
        // Focus: the label is focused from script (Playwright focus()).
        since = await now();
        await p.locator(`.hotspot[data-spot="${spot}"]`).focus();
        trials.focus.push(round(await response('focus', spot, since)));
        await p.evaluate(() => document.activeElement?.blur());
        await drawnAway();
        // Keyboard: Tab from one place to the next, timed from the keydown.
        const from = spots[i % Math.max(1, spots.length - 1)];
        await p.locator(`.hotspot[data-spot="${from}"]`).focus();
        await p.waitForFunction(s => document.querySelector('[data-hover]')?.dataset.hover === s, from, { timeout: 20000 });
        if (reduced) await asleep(p, 10);
        since = await now();
        await p.keyboard.press('Tab');
        const next = await p.evaluate(() => document.activeElement?.dataset.spot ?? null);
        if (next) trials.keyboard.push(round(await response('key', next, since)));
        await p.evaluate(() => document.activeElement?.blur());
        await drawnAway();
      }
      out[motion] = { state: await sceneState(p), spots, trialsMs: trials, errors: p.errors };
      for (const kind of ['pointer', 'focus', 'keyboard']) {
        if (!trials[kind].length) { budget(`place-response.${motion}.${kind}`, 'no trial reached a place', '< 100 ms', false); continue; }
        const worst = Math.max(...trials[kind]);
        budget(`place-response.${motion}.${kind}`, `max ${worst} ms (median ${quantile(trials[kind], 0.5)} ms)`, '< 100 ms', worst < 100, { maxMs: worst, trialsMs: trials[kind] });
      }
    } finally { await close(p); }
  }
  return out;
}

/* (b), (c), (d drag) and (e) in one exploring visit. */
async function exploring() {
  const out = {};
  const p = await open(desktop, '/#whisperbook');
  try {
    await ready(p);
    await waitForSceneSettled(p);
    await enter(p);
    await p.waitForTimeout(1000);
    out.state = await sceneState(p);
    const step = async (name, fn) => { try { out[name] = await fn(); } catch (e) { out[name] = { error: e.message }; budget(`exploring.${name}`, `error: ${e.message.split('\n')[0]}`, 'measurable', false); } };

    await step('active', async () => {
      const w = await measure(p, 3000);
      budget('exploring.active-fps', `${w.fps} fps (${w.gardenFrames} frames in ${w.seconds} s)`, '> 20 fps', w.fps > 20, { fps: w.fps });
      return w;
    });
    await step('resumed', async () => {
      await p.locator('[data-scene-remote="pause"]').evaluate(b => b.click());
      await p.waitForFunction(() => window.__notebookScene.state().motion === 'user-paused');
      const slept = await asleep(p);
      const paused = await measure(p, 1500);
      await p.locator('[data-scene-remote="pause"]').evaluate(b => b.click());
      await p.waitForFunction(() => window.__notebookScene.state().motion === 'normal');
      await p.waitForTimeout(300);
      const w = await measure(p, 2000);
      budget('exploring.resumed-fps', `${w.fps} fps (${w.gardenFrames} frames in ${w.seconds} s)`, '> 20 fps', w.fps > 20, { fps: w.fps });
      return { pausedSlept: slept, paused, resumed: w };
    });
    await step('hiddenTab', async () => {
      await p.evaluate(() => window.__setHidden(true));
      await p.waitForTimeout(300);
      const hidden = await measure(p, 2000);
      // Frames whose drawing started within 800 ms of the tab being shown,
      // timed in the page (the harness's own round trips are not counted).
      const shown = await p.evaluate(() => new Promise(resolve => {
        const P = window.__perf;
        P.frameTimes = []; P.sampling = true;
        const a = window.__notebookStats().garden.frames;
        const t0 = performance.now();
        window.__setHidden(false);
        setTimeout(() => {
          P.sampling = false;
          const within = P.frameTimes.filter(t => t - t0 <= 800).length;
          resolve({ framesWithin800ms: within, gardenFramesTotal: window.__notebookStats().garden.frames - a, elapsedMs: Math.round(performance.now() - t0), firstFrameMs: P.frameTimes.length ? Math.round(P.frameTimes[0] - t0) : null });
        }, 1200);
      }));
      budget('exploring.shown-after-hidden', `${shown.framesWithin800ms} frames in the 0.8 s after showing (first after ${shown.firstFrameMs} ms; hidden: ${hidden.gardenFrames})`, '> 10 frames in 0.8 s', shown.framesWithin800ms > 10, { frames: shown.framesWithin800ms });
      return { hidden, shown };
    });
    await step('dragTurn', async () => {
      await p.waitForTimeout(500);
      const box = await p.locator('.scene-stage').boundingBox();
      const x = box.x + box.width * 0.6, y = box.y + box.height * 0.3;
      const r0 = (await p.evaluate(() => window.__notebookScene.view())).rotation;
      const w = await measure(p, 1000, async () => {
        await p.mouse.move(x, y);
        await p.mouse.down();
        await p.mouse.move(x + 240, y, { steps: 24 });
        await p.mouse.up();
      });
      const turned = (await p.evaluate(() => window.__notebookScene.view())).rotation - r0;
      if (w.maxTaskMs === null) throw new Error('the Long Tasks API is unavailable in this browser');
      budget('exploring.drag-turn-longest-task', `${w.maxTaskMs} ms (${w.longTasks} tasks of 50 ms or more)`, '< 100 ms', w.maxTaskMs < 100, { maxTaskMs: w.maxTaskMs });
      return { ...w, rotationRad: round(turned, 3) };
    });
    await step('readingMotion', async () => {
      await p.locator('[data-explore-exit]').click();
      await p.waitForFunction(() => !window.__notebookScene.state().exploring);
      await waitForSceneSettled(p);
      const w = await measure(p, 3000);
      budget('exploring.reading-motion-after-exit', `${w.gardenFrames} garden frames in ${w.seconds} s (sky ${w.skyFrames})`, '> 0 garden frames over 3 s', w.gardenFrames > 0, { frames: w.gardenFrames });
      return { ...w, state: await sceneState(p) };
    });
    out.errors = p.errors;
  } finally { await close(p); }
  return out;
}

/* (d) The longest task from planting to the end of the fennec's visit. */
async function fennecVisit() {
  const p = await open(desktop, '/#contact');
  try {
    await ready(p);
    await waitForSceneSettled(p);
    await p.locator('.garden > summary').click();
    await p.locator('[data-hour]').evaluate(input => { input.value = '13'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await waitForSceneSettled(p);
    const t0 = await p.evaluate(() => { const P = window.__perf; P.visitMark = { t: performance.now(), frames: window.__notebookStats().garden.frames }; return P.visitMark.t; });
    await p.locator('[data-plant-one]').click();
    await p.waitForFunction(() => window.__notebookStats().garden.visiting === true, null, { timeout: 20000 });
    const tStart = await p.evaluate(() => performance.now());
    await p.waitForFunction(() => window.__notebookStats().garden.visiting === false, null, { timeout: VISIT_TIMEOUT, polling: 100 });
    const r = await p.evaluate(() => {
      const P = window.__perf;
      const t = performance.now();
      const tasks = P.longtasks ? P.longtasks.filter(e => e.start >= P.visitMark.t - 1) : null;
      return { t, frames: window.__notebookStats().garden.frames - P.visitMark.frames, tasks };
    });
    if (r.tasks === null) throw new Error('the Long Tasks API is unavailable in this browser');
    const visitTasks = r.tasks.filter(e => e.start >= tStart);
    const maxTaskMs = round(Math.max(0, ...r.tasks.map(e => e.ms)));
    const seconds = (r.t - t0) / 1000;
    budget('fennec-visit.longest-task', `${maxTaskMs} ms (${r.tasks.length} tasks of 50 ms or more over ${round(seconds)} s)`, '< 100 ms', maxTaskMs < 100, { maxTaskMs });
    return {
      state: await sceneState(p),
      seconds: round(seconds, 2), gardenFrames: r.frames, fps: round(r.frames / seconds),
      longTasks: r.tasks.length, maxTaskMs,
      maxTaskAfterVisitStartMs: round(Math.max(0, ...visitTasks.map(e => e.ms))),
      longestTasksMs: r.tasks.map(e => round(e.ms)).sort((a, b) => b - a).slice(0, 8),
      errors: p.errors,
    };
  } finally { await close(p); }
}

/* (f) First-pose timing of deep links. Report only. */
async function firstPose() {
  const out = {};
  for (const [layout, options] of [['desktop', desktop], ['phone', phone]]) {
    for (const hash of ['#whisperbook', '#contact']) {
      const p = await open(options, '/' + hash);
      try {
        await ready(p);
        await p.waitForFunction(() => window.__perf.liveAt !== null);
        out[`${layout} ${hash}`] = await p.evaluate(() => {
          const P = window.__perf;
          const at = n => performance.getEntriesByName(`notebook:${n}`, 'mark')[0]?.startTime ?? null;
          const measure = n => performance.getEntriesByName(`notebook:${n}`, 'measure')[0]?.duration ?? null;
          const r = v => (v === null ? null : Math.round(v));
          return {
            firstContentfulPaintMs: r(performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null),
            sceneRequestMs: r(at('scene-request')),
            sceneConstructionMs: r(measure('scene-construction')),
            firstRenderMs: r(at('first-render')),
            sceneToFirstRenderMs: r(measure('scene-to-first-render')),
            liveStageMs: r(P.liveAt.t),
            liveChapter: P.liveAt.chapter, liveProgress: P.liveAt.progress, framesBeforeLive: P.liveAt.frames,
            // The long task the reveal happened in: the frame reaches the
            // screen only once that task has ended.
            liveTaskEndMs: P.longtasks ? r(P.longtasks.filter(e => e.start <= P.liveAt.t && e.start + e.ms >= P.liveAt.t).map(e => e.start + e.ms)[0] ?? P.liveAt.t) : null,
            longestTaskBeforeLiveMs: P.longtasks ? r(Math.max(0, ...P.longtasks.filter(e => e.start <= P.liveAt.t).map(e => e.ms))) : null,
            quality: window.__notebookScene.state().quality,
          };
        });
        log(`first-pose ${layout} ${hash}: live after ${out[`${layout} ${hash}`].liveStageMs} ms`);
      } finally { await close(p); }
    }
  }
  return out;
}

/** The documented profile: browser, cores, WebGL renderer. */
async function profile() {
  const context = await browser.newContext(desktop);
  const page = await context.newPage();
  try {
    await page.goto(base + '/?view=read');
    const gl = await page.evaluate(() => {
      const c = document.createElement('canvas');
      const g = c.getContext('webgl2') || c.getContext('webgl');
      if (!g) return { webgl: false };
      const ext = g.getExtension('WEBGL_debug_renderer_info');
      return {
        webgl: g instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl',
        renderer: ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER),
        vendor: ext ? g.getParameter(ext.UNMASKED_VENDOR_WEBGL) : g.getParameter(g.VENDOR),
        rendererUnmasked: !!ext,
        gpuTimers: !!g.getExtension('EXT_disjoint_timer_query_webgl2'),
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory ?? null,
        userAgent: navigator.userAgent,
      };
    });
    return {
      browser: browser.browserType().name(),
      version: browser.version(),
      channel: process.env.PLAYWRIGHT_CHANNEL ?? 'bundled',
      headless: true,
      ...gl,
      softwareRendering: /swiftshader|llvmpipe|softpipe|software|basic render/i.test(`${gl.renderer} ${gl.vendor}`),
      host: { platform: `${os.platform()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0]?.model ?? null, cores: os.cpus().length, memoryGB: Math.round(os.totalmem() / 2 ** 30) },
      viewports: { desktop, phone },
    };
  } finally { await context.close(); }
}

const scenarios = { 'place-response': placeResponse, exploring, 'fennec-visit': fennecVisit, 'first-pose': firstPose };
const results = {};
let prof = null;
try {
  prof = await profile();
  log(`${prof.browser} ${prof.version}, ${prof.hardwareConcurrency} cores, WebGL: ${prof.renderer}${prof.softwareRendering ? ' (software rendering)' : ''}`);
  for (const [name, run] of Object.entries(scenarios)) {
    if (only && !only.includes(name)) continue;
    log(`scenario ${name}`);
    const started = Date.now();
    try { results[name] = await run(); }
    catch (e) {
      results[name] = { error: e.message };
      budget(name, `error: ${e.message.split('\n')[0]}`, 'measurable', false);
    }
    log(`scenario ${name} done in ${round((Date.now() - started) / 1000)} s`);
  }
} finally { await browser.close(); }

const failed = budgets.filter(b => !b.pass);
const report = {
  date: new Date().toISOString(),
  url: base,
  profile: prof,
  conditions: {
    weather: 'Open-Meteo blocked: live weather unavailable, garden default',
    throttling: 'none',
    hidden: 'simulated (document.hidden overridden, visibilitychange fired)',
    response: 'input event timestamp to the end of the first garden frame drawn with the place highlighted (data-hover); compositor presentation not included',
    note: 'Phone rows are desktop-browser emulation, not a physical device. No battery or energy claim is made from these numbers.',
  },
  enforced: enforce,
  budgets,
  failed: failed.map(b => b.id),
  scenarios: results,
};
await mkdir(outDir, { recursive: true });
await writeFile(outDir + 'report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
log(`${budgets.length - failed.length} of ${budgets.length} budgets met${prof?.softwareRendering ? ' on a software renderer' : ''}; report in ${outDir}report.json`);
if (enforce && failed.length) process.exitCode = 1;
