// P4 captures (G2 evidence): the live scene at each chapter's reading hold on
// both layouts, the deep-link first paint at Contact, reduced-motion, failure
// and context-lost states, and two recordings of the release-1 slice with
// reading pauses and a direct jump to Contact. Build, serve dist with
// `npx vite preview --host 127.0.0.1 --port 4417 --strictPort`, then
// `node scripts/capture-p4.mjs` (BASE overrides the URL; ONLY=stills,states,video
// limits the set). Writes .qa/p4/ (git-ignored) and prints each capture's state.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readdirSync, renameSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:4417";
const OUT = ".qa/p4";
const only = process.env.ONLY?.split(",");
const want = name => !only || only.includes(name);
mkdirSync(`${OUT}/stills`, { recursive: true });
mkdirSync(`${OUT}/states`, { recursive: true });
mkdirSync(`${OUT}/video`, { recursive: true });
const chapters = ["intro", "work", "bplog", "whisperbook", "energy-tools", "mcq-scan", "about", "contact"];
const layouts = {
  wide: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  portrait: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const log = [];
const browser = await chromium.launch();

async function open(options, path, prepare) {
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", e => page.errors.push(String(e)));
  if (prepare) await prepare(page);
  await page.goto(BASE + path);
  await page.waitForFunction(() => document.documentElement.classList.contains("enhanced"));
  return { ctx, page };
}
const state = page => page.evaluate(() => {
  const s = window.__notebookScene.state();
  return { url: location.pathname + location.search + location.hash, scrollY: Math.round(scrollY), chapter: s.chapter, host: s.host, renderer: s.renderer, live: s.live, motion: s.motion, held: s.held, settled: s.settled, progress: s.pose?.progress ?? null, frames: window.__notebookStats().garden?.frames ?? null };
});
const settledOn = (page, chapter) => page.waitForFunction(c => {
  const s = window.__notebookScene.state();
  return s.live && s.chapter === c && s.transition === 1 && s.settled;
}, chapter, { timeout: 60000 });
async function shot(page, name, extra = {}) {
  const s = await state(page);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log.push({ name, ...s, ...extra, errors: page.errors.length });
  console.log(name.padEnd(36), JSON.stringify(s));
}
/** Explicit jump to a chapter, through the page's own link handling. */
async function jump(page, id) {
  await page.evaluate(id => {
    const a = document.createElement("a");
    a.href = `#${id}`;
    a.textContent = id;
    document.querySelector("main").append(a);
    a.click();
    a.remove();
  }, id);
}

if (want("stills")) {
  for (const [layout, options] of Object.entries(layouts)) {
    const { ctx, page } = await open(options, "/");
    await page.waitForFunction(() => window.__notebookScene.state().live, null, { timeout: 60000 });
    for (const id of chapters) {
      if (id !== "intro") await jump(page, id);
      else await page.evaluate(() => scrollTo(0, 0));
      await settledOn(page, id);
      // Portrait: bring the chapter's slot fully into view, as a reader would.
      if (layout === "portrait") {
        await page.evaluate(id => {
          const slot = document.querySelector(`[data-scene-host="${id}"]`);
          const box = slot.getBoundingClientRect();
          scrollBy(0, box.top - (innerHeight - box.height) / 2);
        }, id);
        await page.waitForTimeout(400);
        await settledOn(page, id);
      }
      await page.waitForTimeout(600);
      await shot(page, `stills/${layout}-${id}`);
    }
    await ctx.close();
  }
}

if (want("states")) {
  // Deep link: the first paint at Contact, while the scene module is still on its way.
  for (const [layout, options] of Object.entries(layouts)) {
    let release;
    const gate = new Promise(r => { release = r; });
    const { ctx, page } = await open(options, "/#contact", p => p.route(/\/assets\/scene-[\w-]+\.js$/, async route => { await gate; await route.continue(); }));
    await page.waitForTimeout(800);
    await shot(page, `states/${layout}-deeplink-contact-first-paint`);
    release();
    await settledOn(page, "contact");
    await page.waitForTimeout(500);
    await shot(page, `states/${layout}-deeplink-contact-live`);
    await ctx.close();
  }
  // Reduced motion: stills, no scene; the controls open.
  for (const [layout, options] of Object.entries(layouts)) {
    const { ctx, page } = await open({ ...options, reducedMotion: "reduce" }, "/#whisperbook");
    await page.waitForTimeout(1500);
    await page.locator(".scene-toggle").click();
    await shot(page, `states/${layout}-reduced-motion`);
    await ctx.close();
  }
  // Failure: the scene module cannot load; the poster and text stay.
  for (const [layout, options] of Object.entries(layouts)) {
    const { ctx, page } = await open(options, "/#whisperbook", p => p.route(/\/assets\/scene-[\w-]+\.js$/, route => route.abort()));
    await page.waitForFunction(() => document.documentElement.dataset.renderer === "failed");
    await page.locator(".scene-toggle").click();
    await shot(page, `states/${layout}-failed`);
    await ctx.close();
  }
  // Context lost at Contact: the matching still, links intact.
  {
    const { ctx, page } = await open(layouts.wide, "/#contact");
    await settledOn(page, "contact");
    await page.evaluate(() => document.querySelector(".scene-garden canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext());
    await page.waitForFunction(() => document.documentElement.dataset.renderer === "context-lost");
    await page.waitForTimeout(300);
    await shot(page, "states/wide-context-lost");
    await ctx.close();
  }
}

if (want("video")) {
  for (const [layout, options] of Object.entries(layouts)) {
    const dir = `${OUT}/video/tmp-${layout}`;
    mkdirSync(dir, { recursive: true });
    const { ctx, page } = await open({ ...options, recordVideo: { dir, size: options.viewport } }, "/");
    const t0 = Date.now();
    const steps = [];
    const mark = async label => { const s = await state(page); steps.push({ t: (Date.now() - t0) / 1000, label, ...s }); console.log(layout, label, JSON.stringify(s)); };
    await page.waitForFunction(() => window.__notebookScene.state().live, null, { timeout: 60000 });
    await mark("live at the opening");
    await page.waitForTimeout(3500);
    // Read on by scrolling, pausing at each chapter of the slice.
    for (const id of ["work", "bplog", "whisperbook"]) {
      for (let i = 0; i < 80 && (await state(page)).chapter !== id; i++) { await page.mouse.wheel(0, layout === "wide" ? 120 : 90); await page.waitForTimeout(60); }
      await mark(`scrolled into ${id}`);
      await settledOn(page, id).catch(() => {});
      await mark(`settled at ${id}, reading pause`);
      await page.waitForTimeout(2500);
    }
    // A direct jump to Contact.
    await page.locator('.nav-sections a[href="#contact"]').click();
    await settledOn(page, "contact");
    await mark("jumped to contact, reading pause");
    await page.waitForTimeout(3000);
    // And back to the work index, directly.
    await page.locator('.nav-sections a[href="#work"]').click();
    await settledOn(page, "work");
    await mark("jumped back to work");
    await page.waitForTimeout(2000);
    const video = page.video();
    await ctx.close();
    renameSync(await video.path(), `${OUT}/video/${layout}.webm`);
    writeFileSync(`${OUT}/video/${layout}-steps.json`, JSON.stringify(steps, null, 1));
  }
}

await browser.close();
writeFileSync(`${OUT}/captures.json`, JSON.stringify(log, null, 1));
const errors = log.filter(l => l.errors).length;
console.log(`${log.length} captures, ${errors} with page errors`);
