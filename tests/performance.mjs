/* Reproducible performance baseline for the notebook (OPTIMIZATION-PLAN.md, item 1).

   Scenarios follow the current presentation modes:
     desktop-garden   1440×900 @1.6, the scroll story, then Bloom, a project,
                      planting, a storm, pause and a hidden/resumed tab.
     phone-journey    390×844 @3 portrait touch phone: the live-garden journey
                      through every stop, then settled, paused and hidden.
     phone-stills     the same phone with ?view=stills: stills only, no scene.
     reading          1440×900 reading page: no scene.

   Rendering is measured from the page, not from a scheduling probe: every
   WebGL draw call is counted and grouped by animation frame, so `draws` is
   the frames the garden actually drew. `rafCallbacks` counts every
   requestAnimationFrame request made by the page (the harness's own probe is
   excluded). Hidden is simulated by overriding document.hidden and firing
   visibilitychange, which measures what the page schedules; a really hidden
   tab is throttled by the browser regardless.

   RUNS (default 5) matched runs per scenario; SCENARIOS limits the set,
   e.g. SCENARIOS=desktop-garden,reading. Output: $QA_OUTPUT/performance.json
   with every run and medians/p95 per metric, and a one-line summary per run. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';

const base = process.env.TEST_URL || 'http://127.0.0.1:5199';
const output = process.env.QA_OUTPUT || '/private/tmp/notebook-qa';
const RUNS = Number(process.env.RUNS || 5);
const only = process.env.SCENARIOS?.split(',');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });

/* Installed before any page script. */
function instrument() {
  const raf = window.requestAnimationFrame.bind(window);
  const p = window.__perf = { raf: 0, draws: 0, drawFrames: 0, drawTimes: [], probe: [], tick: 0, tickSeen: -1, longtasks: [], sampling: false };
  window.requestAnimationFrame = (cb) => { p.raf++; return raf(cb); };
  // A probe on the original requestAnimationFrame numbers the frames.
  const probe = (t) => { p.tick++; if (p.sampling) p.probe.push(t); raf(probe); };
  raf(probe);
  for (const proto of [window.WebGL2RenderingContext?.prototype, window.WebGLRenderingContext?.prototype]) {
    if (!proto) continue;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const f = proto[name];
      if (!f) continue;
      proto[name] = function (...args) {
        p.draws++;
        if (p.tickSeen !== p.tick) { p.tickSeen = p.tick; p.drawFrames++; if (p.sampling) p.drawTimes.push(performance.now()); }
        return f.apply(this, args);
      };
    }
  }
  new PerformanceObserver((l) => p.longtasks.push(...l.getEntries().map((e) => ({ start: e.startTime, ms: e.duration })))).observe({ type: 'longtask', buffered: true });
  let hidden = false;
  Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  window.__setHidden = (h) => { hidden = h; document.dispatchEvent(new Event('visibilitychange')); };
}

const sorted = (xs) => [...xs].sort((a, b) => a - b);
const quantile = (xs, q) => { const s = sorted(xs); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : null; };
const round = (n, d = 2) => (n === null || n === undefined ? null : Math.round(n * 10 ** d) / 10 ** d);
const intervals = (ts) => ts.slice(1).map((t, i) => t - ts[i]);

/* One measured window: what the page scheduled, drew and blocked on. */
async function window_(page, name, ms, act) {
  await page.evaluate(() => { const p = window.__perf; p.sampling = true; p.mark = { raf: p.raf, draws: p.draws, drawFrames: p.drawFrames, t: performance.now(), tasks: p.longtasks.length }; p.drawTimes = []; p.probe = []; });
  if (act) await act();
  await page.waitForTimeout(ms);
  const r = await page.evaluate(() => {
    const p = window.__perf; p.sampling = false;
    const seconds = (performance.now() - p.mark.t) / 1000;
    return { seconds, raf: p.raf - p.mark.raf, drawCalls: p.draws - p.mark.draws, drawFrames: p.drawFrames - p.mark.drawFrames, drawTimes: p.drawTimes, probe: p.probe, tasks: p.longtasks.slice(p.mark.tasks) };
  });
  const draw = intervals(r.drawTimes), probe = intervals(r.probe);
  return {
    name,
    seconds: round(r.seconds),
    rafPerSecond: round(r.raf / r.seconds, 1),
    drawFramesPerSecond: round(r.drawFrames / r.seconds, 1),
    drawCallsPerFrame: r.drawFrames ? round(r.drawCalls / r.drawFrames, 1) : 0,
    drawIntervalP50: round(quantile(draw, 0.5)), drawIntervalP95: round(quantile(draw, 0.95)),
    drawMissed33: draw.length ? round(draw.filter((d) => d > 34).length / draw.length, 4) : null,
    probeIntervalP95: round(quantile(probe, 0.95)),
    maxTaskMs: round(Math.max(0, ...r.tasks.map((t) => t.ms))), tasksOver50: r.tasks.length,
  };
}

async function sceneInfo(page) {
  return page.evaluate(() => {
    const scene = document.querySelector('#scene');
    const m = (n) => performance.getEntriesByName(`notebook:${n}`, 'measure')[0]?.duration ?? null;
    const stats = window.__notebookStats?.() ?? null;
    return {
      canvas: !!scene?.querySelector('canvas'),
      quality: scene?.dataset.quality ?? null,
      drawCalls: Number(scene?.dataset.drawCalls ?? NaN) || null,
      triangles: Number(scene?.dataset.triangles ?? NaN) || null,
      geometries: Number(scene?.dataset.geometries ?? NaN) || null,
      textures: Number(scene?.dataset.textures ?? NaN) || null,
      constructionMs: m('scene-construction'), sceneToFirstRenderMs: m('scene-to-first-render'), shaderWarmupMs: m('shader-warmup'),
      stats,
      hour: document.querySelector('#hour')?.value ?? null,
      season: document.documentElement.dataset.season ?? null,
      fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
    };
  });
}

/* Bytes by kind from Resource Timing. Cross-origin sizes may be hidden (0). */
async function transferReport(page) {
  return page.evaluate(() => {
    const out = {};
    const kind = (e) => /\.(webp|png|jpe?g|svg|avif)(\?|$)/.test(e.name) ? 'image' : /\.(woff2?|ttf)(\?|$)/.test(e.name) ? 'font' : /\.css(\?|$)/.test(e.name) ? 'css' : /\.js(\?|$)/.test(e.name) ? (/scene-/.test(e.name) ? 'scene-js' : 'js') : e.initiatorType;
    const entries = [performance.getEntriesByType('navigation')[0], ...performance.getEntriesByType('resource')].filter(Boolean);
    for (const e of entries) {
      const k = e.entryType === 'navigation' ? 'document' : kind(e);
      out[k] ??= { requests: 0, transfer: 0, decoded: 0 };
      out[k].requests++; out[k].transfer += e.transferSize; out[k].decoded += e.decodedBodySize;
    }
    const total = Object.values(out).reduce((a, b) => ({ requests: a.requests + b.requests, transfer: a.transfer + b.transfer, decoded: a.decoded + b.decoded }), { requests: 0, transfer: 0, decoded: 0 });
    const images = entries.filter((e) => /\.(webp|png|jpe?g)/.test(e.name)).map((e) => ({ url: new URL(e.name).pathname, transfer: e.transferSize, decoded: e.decodedBodySize }));
    return { byKind: out, total, images };
  });
}

async function newPage(options, url) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.route('**/*open-meteo.com/**', (r) => r.abort());
  await page.addInitScript(instrument);
  await page.goto(base + url);
  await page.waitForFunction(() => document.documentElement.classList.contains('enhanced'));
  return page;
}
const settledShaders = (page) => page.waitForFunction(() => performance.getEntriesByName('notebook:shader-first-use-complete').length > 0, {}, { timeout: 30000 });

const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.6 };
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

const scenarios = {
  async 'desktop-garden'() {
    const page = await newPage(desktop, '/');
    await page.waitForFunction(() => document.querySelector('#scene')?.dataset.progress);
    await settledShaders(page);
    const cold = { ...(await sceneInfo(page)), tasks: await page.evaluate(() => window.__perf.longtasks) };
    const windows = [];
    windows.push(await window_(page, 'opening-sketch', 2000));
    // The scroll story: every note in turn through the ruler.
    windows.push(await window_(page, 'stage-transitions', 400, async () => {
      const positions = await page.locator('.chapter').evaluateAll((es) => es.map((e) => Math.min(e.offsetTop, document.documentElement.scrollHeight - innerHeight)));
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      for (const y of positions) { await page.locator('#scrub').fill(String(Math.ceil((y / max) * 1000))); await page.waitForTimeout(220); }
    }));
    await page.locator('.masthead a[href="#contact"]').click();
    await page.waitForTimeout(3500);
    windows.push(await window_(page, 'bloom-settled', 3000));
    windows.push(await window_(page, 'project-focus', 2500, () => page.evaluate(() => { location.hash = 'whisperbook'; })));
    await page.locator('.masthead a[href="#contact"]').click();
    await page.waitForTimeout(3000);
    await page.locator('.dock > summary').click();
    windows.push(await window_(page, 'planting', 2500, async () => { for (let i = 0; i < 3; i++) await page.locator('#plant-one').click(); }));
    windows.push(await window_(page, 'heavy-weather', 3000, () => page.getByRole('button', { name: 'Storm', exact: true }).click()));
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await page.locator('.dock > summary').click();
    await page.waitForTimeout(1500);
    await page.locator('#motion-toggle').click();
    await page.waitForTimeout(1200);
    windows.push(await window_(page, 'paused-settled', 3000));
    windows.push(await window_(page, 'paused-hidden', 3000, () => page.evaluate(() => window.__setHidden(true))));
    await page.evaluate(() => window.__setHidden(false));
    await page.locator('#motion-toggle').click();
    windows.push(await window_(page, 'resumed', 2000));
    windows.push(await window_(page, 'hidden', 3000, () => page.evaluate(() => window.__setHidden(true))));
    windows.push(await window_(page, 'visible-again', 2000, () => page.evaluate(() => window.__setHidden(false))));
    const after = await sceneInfo(page);
    const transfer = await transferReport(page);
    return { page, cold, windows, after, transfer };
  },
  async 'phone-journey'() {
    const page = await newPage(phone, '/');
    await page.waitForFunction(() => document.querySelector('#scene')?.dataset.progress, {}, { timeout: 30000 });
    await settledShaders(page);
    const cold = { ...(await sceneInfo(page)), tasks: await page.evaluate(() => window.__perf.longtasks) };
    const windows = [];
    windows.push(await window_(page, 'opening-sketch', 2000));
    windows.push(await window_(page, 'journey-scroll', 500, async () => {
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      for (let y = 0; y <= max; y += 120) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(60); }
    }));
    await page.waitForTimeout(2500);
    windows.push(await window_(page, 'bloom-settled', 3000));
    windows.push(await window_(page, 'hidden', 3000, () => page.evaluate(() => window.__setHidden(true))));
    await page.evaluate(() => window.__setHidden(false));
    await page.locator('.journey-pause, #motion-toggle').first().click().catch(() => {});
    await page.waitForTimeout(1200);
    windows.push(await window_(page, 'paused-settled', 3000));
    const after = await sceneInfo(page);
    const transfer = await transferReport(page);
    return { page, cold, windows, after, transfer };
  },
  async 'phone-stills'() {
    const page = await newPage(phone, '/?view=stills');
    await page.waitForTimeout(800);
    const windows = [await window_(page, 'stills-scroll', 500, async () => {
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      for (let y = 0; y <= max; y += 160) { await page.evaluate((y) => scrollTo(0, y), y); await page.waitForTimeout(60); }
    })];
    await page.waitForTimeout(1000);
    return { page, cold: await sceneInfo(page), windows, transfer: await transferReport(page) };
  },
  async reading() {
    const page = await newPage(desktop, '/?view=read');
    await page.waitForTimeout(800);
    const windows = [await window_(page, 'reading-navigation', 500, async () => {
      for (const id of ['work', 'about', 'contact', 'work']) { await page.locator(`.masthead a[href="#${id}"]`).click(); await page.waitForTimeout(700); }
    })];
    return { page, cold: await sceneInfo(page), windows, transfer: await transferReport(page) };
  },
};

/* Warm transfer: the same page reloaded in the same context. */
async function warmTransfer(page) {
  await page.reload();
  await page.waitForTimeout(2500);
  return transferReport(page);
}

const results = [];
try {
  for (const [name, run] of Object.entries(scenarios)) {
    if (only && !only.includes(name)) continue;
    for (let i = 0; i < RUNS; i++) {
      const r = await run();
      const warm = i === 0 ? await warmTransfer(r.page) : null;
      const errors = r.page.errors;
      await r.page.context().close();
      const { page, ...rest } = r;
      results.push({ scenario: name, run: i + 1, ...rest, warmTransfer: warm, errors });
      console.log(JSON.stringify({ scenario: name, run: i + 1, bytes: r.transfer.total.transfer, ...Object.fromEntries(r.windows.map((w) => [w.name, `${w.drawFramesPerSecond} draws/s ${w.rafPerSecond} raf/s p95 ${w.drawIntervalP95}`])) }));
    }
  }
  // Medians and p95 across runs, per scenario and window.
  const summary = {};
  for (const r of results) {
    const s = (summary[r.scenario] ??= { runs: 0, windows: {}, cold: {}, transferBytes: [] });
    s.runs++;
    s.transferBytes.push(r.transfer.total.transfer);
    for (const k of ['constructionMs', 'sceneToFirstRenderMs', 'shaderWarmupMs', 'drawCalls', 'triangles', 'fcp']) (s.cold[k] ??= []).push(r.cold?.[k] ?? null);
    for (const w of r.windows) for (const [k, v] of Object.entries(w)) if (typeof v === 'number') ((s.windows[w.name] ??= {})[k] ??= []).push(v);
  }
  const stat = (xs) => { const v = xs.filter((x) => typeof x === 'number'); return v.length ? { median: round(quantile(v, 0.5)), p95: round(quantile(v, 0.95)) } : 'unavailable'; };
  for (const s of Object.values(summary)) {
    s.transferBytes = stat(s.transferBytes);
    for (const k in s.cold) s.cold[k] = stat(s.cold[k]);
    for (const w of Object.values(s.windows)) for (const k in w) w[k] = stat(w[k]);
  }
  const report = {
    date: new Date().toISOString(),
    browser: `${browser.browserType().name()} ${browser.version()}`,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'bundled',
    headless: true,
    hardware: { platform: `${os.platform()} ${os.release()}`, cpu: os.cpus()[0]?.model, cores: os.cpus().length, memoryGB: Math.round(os.totalmem() / 2 ** 30) },
    conditions: { weather: 'Open-Meteo blocked: live weather unavailable, garden default', throttling: 'none', note: 'Desktop and phone rows are desktop-browser emulation, not physical devices. Hidden is simulated.' },
    viewports: { desktop, phone },
    runs: RUNS,
    unavailable: ['GPU timing is only present where the browser exposes EXT_disjoint_timer_query_webgl2 (see stats.gpuMs)', 'energy: not measured'],
    summary,
    results,
  };
  await writeFile(output + '/performance.json', JSON.stringify(report, null, 2));
  await writeFile(output + '/performance-summary.json', JSON.stringify({ ...report, results: undefined }, null, 2));
  console.log('Wrote ' + output + '/performance.json');
} finally { await browser.close(); }
