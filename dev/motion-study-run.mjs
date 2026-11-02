// P1 motion study automation: measurements (hold, settle, snap, reverse,
// rapid scroll, reduced motion, portrait sticky slot) and recordings.
// Usage: STUDY_URL=http://127.0.0.1:5311 node dev/motion-study-run.mjs [measure|record|all]
// Output: .qa/p1/measurements.json, .qa/p1/video/{wide,portrait}.webm
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, renameSync, readdirSync, rmSync } from "node:fs";

const base = process.env.STUDY_URL ?? "http://127.0.0.1:5311";
const mode = process.argv[2] ?? "all";
const out = ".qa/p1";
mkdirSync(out, { recursive: true });
const hosts = {
  wide: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  portrait: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const browser = await chromium.launch();

const frames = (page) => page.evaluate(() => window.__study.garden.stats().frames);
const progress = (page) => page.evaluate(() => Number(window.__study.scene.dataset.progress));
const settled = (page) => page.waitForFunction(() => window.__study.adapter.isSettled(), null, { timeout: 30000, polling: 50 });
async function open(page) {
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  await page.goto(`${base}/dev/motion-study.html`);
  await page.waitForFunction(() => document.documentElement.dataset.studyReady === "true", null, { timeout: 60000 });
  await settled(page);
}
/** Ms from now until the scene reports settled, sampling progress along the way. */
async function timeSettle(page, start) {
  return page.evaluate(async (start) => {
    const { adapter, scene, garden } = window.__study;
    const t0 = performance.now();
    const f0 = garden.stats().frames;
    const samples = [];
    const done = new Promise((resolve) => {
      const off = adapter.onSettled(() => { off(); resolve(); });
    });
    (0, eval)(start);
    const sampler = setInterval(() => samples.push([Math.round(performance.now() - t0), Number(scene.dataset.progress)]), 100);
    await done;
    clearInterval(sampler);
    return { ms: Math.round(performance.now() - t0), frames: garden.stats().frames - f0, endProgress: Number(scene.dataset.progress), samples };
  }, start);
}
/** A reader's scroll: small steps at display rate, to a chapter's section top. */
async function scrollTo(page, id, ms = 1600, selector = null, offset = 0) {
  await page.evaluate(async ({ id, ms, selector, offset }) => {
    const el = selector ? document.querySelector(selector) : document.getElementById(id);
    const target = el.getBoundingClientRect().top + scrollY - document.querySelector(".bar").offsetHeight + offset;
    const from = scrollY, t0 = performance.now();
    await new Promise((resolve) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        window.scrollTo(0, from + (target - from) * e);
        k < 1 ? requestAnimationFrame(step) : resolve();
      };
      step();
    });
  }, { id, ms, selector, offset });
}

async function measure(hostName) {
  const context = await browser.newContext(hosts[hostName]);
  const page = await context.newPage();
  await open(page);
  const r = { host: hostName };

  // 1. Hold at Build (Whisperbook) and Bloom (Contact): 10 s settled, frames before/after.
  for (const id of ["whisperbook", "contact"]) {
    await page.evaluate((id) => window.__study.jump(id), id);
    await settled(page);
    await page.waitForTimeout(500);
    const before = await frames(page);
    await page.waitForTimeout(10000);
    const after = await frames(page);
    r[`hold-${id}`] = { progress: await progress(page), framesBefore: before, framesAfter: after, delta: after - before, held: await page.evaluate(() => window.__study.adapter.state().held) };
  }
  // 2. Control: the same Bloom scene with ambient released draws continuously.
  await page.evaluate(() => window.__study.adapter.release());
  await page.waitForTimeout(1000);
  {
    const before = await frames(page);
    await page.waitForTimeout(10000);
    const after = await frames(page);
    r["ambient-released-contact"] = { framesBefore: before, framesAfter: after, delta: after - before, perSecond: (after - before) / 10 };
  }
  await page.evaluate(() => window.__study.adapter.hold());
  await settled(page);
  await page.waitForTimeout(1500);
  // 3. Navigation after a hold still draws its destination once (immediate jump).
  {
    const before = await frames(page);
    await page.evaluate(() => window.__study.jump("work"));
    await page.waitForTimeout(600);
    const after = await frames(page);
    r["jump-after-hold"] = { to: "work", progress: await progress(page), framesDrawn: after - before };
  }
  // 3b. Direct jumps (explicit navigation): time and frames until the destination is drawn.
  r["direct-jumps"] = [];
  for (const id of ["whisperbook", "contact", "intro", "contact", "work"]) {
    r["direct-jumps"].push({ to: id, ...(await timeSettle(page, `window.__study.jump(${JSON.stringify(id)})`)) });
    await page.waitForTimeout(800);
  }
  // 4. Eased transitions: forward over two chapters and reverse; settle times.
  await page.evaluate(() => window.__study.jump("intro"));
  await settled(page);
  r["eased-intro-to-whisperbook"] = await timeSettle(page, "window.__study.adapter.go('whisperbook')");
  r["eased-reverse-whisperbook-to-work"] = await timeSettle(page, "window.__study.adapter.go('work')");
  r["eased-work-to-contact"] = await timeSettle(page, "window.__study.adapter.go('contact')");
  r["eased-reverse-contact-to-intro"] = await timeSettle(page, "window.__study.adapter.go('intro')");
  // 5. snapTo sets no reduced flag: a later change still eases.
  await page.evaluate(() => window.__study.adapter.snapTo({ progress: 0.33, focus: "work" }));
  await page.waitForTimeout(300);
  r["snap-then-eased"] = { afterSnap: await progress(page), next: await timeSettle(page, "window.__study.adapter.go('whisperbook')") };
  // Contrast: the scene's own setProgress(p, true) persists `reduced`, so the next focus lands at once.
  await page.evaluate(() => window.__study.adapter.snapTo({ progress: 0.33, focus: "work" }));
  await settled(page);
  r["legacy-immediate-then-focus"] = await timeSettle(page, "window.__study.garden.setProgress(0.33, true); window.__study.garden.focus('wattch', 0, 0, 0.5)");
  await page.evaluate(() => window.__study.garden.setProgress(0.33, false));
  // 6. Rapid scroll from intro to about: only the last destination is applied.
  await page.evaluate(() => window.__study.jump("intro"));
  await settled(page);
  await page.waitForTimeout(300);
  {
    const logStart = await page.evaluate(() => window.__study.log.length);
    await scrollTo(page, "about", 350);
    await settled(page);
    await page.waitForTimeout(300);
    const log = await page.evaluate((n) => window.__study.log.slice(n), logStart);
    r["rapid-scroll-intro-to-about"] = {
      gos: log.filter((e) => e.type === "go").map((e) => e.chapter),
      settledEvents: log.filter((e) => e.type === "settled").map((e) => ({ chapter: e.chapter, ms: e.ms })),
      endProgress: await progress(page),
      endChapter: await page.evaluate(() => window.__study.adapter.state().chapter),
    };
  }
  // 7. System-reduced: changes land at once; back to normal, easing resumes.
  await page.evaluate(() => window.__study.adapter.setMotionPreference("system-reduced"));
  r["reduced-go-contact"] = await timeSettle(page, "window.__study.adapter.go('contact')");
  {
    const before = await frames(page);
    await page.waitForTimeout(3000);
    r["reduced-hold-3s"] = { delta: (await frames(page)) - before };
  }
  await page.evaluate(() => window.__study.adapter.setMotionPreference("normal"));
  r["normal-again-go-work"] = await timeSettle(page, "window.__study.adapter.go('work')");
  // 8. Portrait: the slot sticks to the top while a scroll-driven transition runs, then releases.
  if (hostName === "portrait") {
    await page.evaluate(() => window.__study.jump("bplog"));
    await settled(page);
    await page.waitForTimeout(300);
    const trace = [];
    const t0 = Date.now();
    const scrolling = scrollTo(page, "whisperbook", 2400);
    for (let i = 0; i < 40; i++) {
      trace.push(await page.evaluate(() => {
        const slot = window.__study.scene.parentElement;
        return { chapter: window.__study.adapter.state().chapter, transit: slot.classList.contains("transit"), slotTop: Math.round(slot.getBoundingClientRect().top), settled: window.__study.adapter.isSettled() };
      }));
      trace[trace.length - 1].t = Date.now() - t0;
      await page.waitForTimeout(100);
    }
    await scrolling;
    r["portrait-sticky-trace"] = trace;
    // The reader keeps going past the slot toward the decision while the
    // transition runs (slot's natural top 160 px above the view): the slot
    // holds at the top until settled, then releases into flow.
    await page.evaluate(() => window.__study.jump("bplog"));
    await settled(page);
    await page.waitForTimeout(300);
    const trace2 = [];
    const t1 = Date.now();
    const reading = scrollTo(page, null, 1100, "#whisperbook [data-slot]", 160);
    let shot = false;
    for (let i = 0; i < 45; i++) {
      const s = await page.evaluate(() => {
        const slot = window.__study.scene.parentElement;
        return { chapter: window.__study.adapter.state().chapter, transit: slot.classList.contains("transit"), slotTop: Math.round(slot.getBoundingClientRect().top), settled: window.__study.adapter.isSettled() };
      });
      s.t = Date.now() - t1;
      trace2.push(s);
      if (!shot && s.transit && s.slotTop <= 0 && s.t > 900) {
        await page.screenshot({ path: `${out}/stills/portrait-sticky-transit.png` });
        shot = true;
      }
      await page.waitForTimeout(80);
    }
    await reading;
    await page.screenshot({ path: `${out}/stills/portrait-sticky-released.png` });
    r["portrait-sticky-reading-trace"] = trace2;
  }
  r.log = await page.evaluate(() => window.__study.log.map(({ t, ...e }) => e));
  await context.close();
  return r;
}

async function record(hostName) {
  const dir = `${out}/video/tmp-${hostName}`;
  rmSync(dir, { recursive: true, force: true });
  const context = await browser.newContext({ ...hosts[hostName], recordVideo: { dir, size: hosts[hostName].viewport } });
  const page = await context.newPage();
  await open(page);
  const pause = () => page.waitForTimeout(2500);
  const steps = [];
  const mark = async (label) => steps.push({ label, at: Date.now(), chapter: await page.evaluate(() => window.__study.adapter.state().chapter), progress: await progress(page) });
  const t0 = Date.now();
  await mark("sketch: reading pause");
  await pause();
  for (const id of ["work", "bplog", "whisperbook"]) {
    await scrollTo(page, id);
    await settled(page);
    await mark(`${id}: settled, reading pause`);
    await pause();
  }
  // Direct jump to Bloom.
  await page.click('[data-go="contact"]');
  await settled(page);
  await mark("direct jump to contact (Bloom)");
  await pause();
  // Reverse reading scroll back to Whisperbook (passes about, mcq-scan, energy-tools).
  await scrollTo(page, "whisperbook", 1800);
  await settled(page);
  await mark("reverse scroll to whisperbook: settled");
  await pause();
  // Direct jump back to the sketch.
  await page.click('[data-go="intro"]');
  await settled(page);
  await mark("direct jump to intro (Sketch)");
  await pause();
  await context.close();
  const file = readdirSync(dir).find((f) => f.endsWith(".webm"));
  mkdirSync(`${out}/video`, { recursive: true });
  renameSync(`${dir}/${file}`, `${out}/video/${hostName}.webm`);
  rmSync(dir, { recursive: true, force: true });
  return { host: hostName, video: `${out}/video/${hostName}.webm`, steps: steps.map((s) => ({ ...s, at: ((s.at - t0) / 1000).toFixed(1) + "s" })) };
}

const result = { url: base, browser: browser.version(), when: new Date().toISOString() };
if (mode === "measure" || mode === "all") result.measure = [await measure("wide"), await measure("portrait")];
if (mode === "record" || mode === "all") result.record = [await record("wide"), await record("portrait")];
await browser.close();
writeFileSync(`${out}/${mode === "record" ? "recordings" : "measurements"}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, (k, v) => (k === "samples" || k === "log" || k === "portrait-sticky-trace" || k === "portrait-sticky-reading-trace" ? undefined : v), 1));
