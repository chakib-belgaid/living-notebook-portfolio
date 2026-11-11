// P3 slice captures: intro → work → Whisperbook → /work/whispbook/ (EN, FR)
// → Return → #whisperbook → contact, at 1440×900 and 390×844, plus 320px and
// first viewports and the other retained cases' tops. Build, serve
// dist with `npx vite preview --host 127.0.0.1 --port 4317 --strictPort`,
// then `node scripts/capture-p3-slice.mjs` (BASE overrides the URL).
// Writes .qa/p3/ (git-ignored) and prints the state behind each capture.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:4317";
const OUT = ".qa/p3";
mkdirSync(OUT, { recursive: true });
const sizes = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const log = [];
const browser = await chromium.launch();

async function context(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", e => page.errors.push(String(e)));
  return { ctx, page };
}
const enhanced = page => page.waitForFunction(() => document.documentElement.classList.contains("enhanced"));
const frames = page => page.evaluate(() => document.fonts.ready.then(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))));
async function shot(page, name) {
  await frames(page);
  const state = await page.evaluate(() => ({
    url: location.pathname + location.search + location.hash,
    scrollY: Math.round(scrollY),
    focus: document.activeElement?.id || document.activeElement?.tagName,
    current: [...document.querySelectorAll('.primary-nav a[aria-current="page"]')].map(a => a.getAttribute("href")).join(","),
    scrollWidth: document.documentElement.scrollWidth,
  }));
  await page.screenshot({ path: `${OUT}/${name}.png` });
  log.push({ name, ...state, errors: page.errors.length });
  console.log(name.padEnd(34), JSON.stringify(state));
}

for (const [label, viewport] of Object.entries(sizes)) {
  const { ctx, page } = await context(viewport);
  await page.goto(BASE + "/");
  await enhanced(page);
  await shot(page, `${label}-1-entry`);
  await page.locator('.nav-sections a[href="#work"]').click();
  await shot(page, `${label}-2-work`);
  await page.locator('.work-index a[href="#whisperbook"]').click();
  await shot(page, `${label}-3-whisperbook`);
  await page.locator("#whisperbook a.action-case").scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await Promise.all([page.waitForURL(u => u.pathname === "/work/whispbook/"), page.locator("#whisperbook a.action-case").click()]);
  await shot(page, `${label}-4-case-en`);
  await page.screenshot({ path: `${OUT}/${label}-4-case-en-full.png`, fullPage: true });
  await Promise.all([page.waitForURL(u => u.pathname === "/"), page.locator("a[data-return]").first().click()]);
  await enhanced(page);
  await page.waitForTimeout(300);
  await shot(page, `${label}-5-after-return`);
  await page.locator('.nav-sections a[href="#contact"]').click();
  await shot(page, `${label}-6-contact`);
  await ctx.close();

  // The French case, reached from the French homepage, and its return.
  const fr = await context(viewport);
  await fr.page.goto(BASE + "/?lang=fr#whisperbook");
  await enhanced(fr.page);
  await fr.page.locator("#whisperbook a.action-case").scrollIntoViewIfNeeded();
  await Promise.all([fr.page.waitForURL(u => u.pathname === "/fr/work/whispbook/"), fr.page.locator("#whisperbook a.action-case").click()]);
  await shot(fr.page, `${label}-7-case-fr`);
  await fr.page.screenshot({ path: `${OUT}/${label}-7-case-fr-full.png`, fullPage: true });
  await Promise.all([fr.page.waitForURL(u => u.pathname === "/"), fr.page.locator("a[data-return]").last().click()]);
  await enhanced(fr.page);
  await fr.page.waitForTimeout(300);
  await shot(fr.page, `${label}-8-after-return-fr`);
  await fr.ctx.close();

}

for (const lang of ["en", "fr"]) {
  const { ctx, page } = await context({ width: 320, height: 568 });
  await page.goto(`${BASE}/?lang=${lang}`);
  await enhanced(page);
  await shot(page, `narrow320-${lang}-first`);
  await ctx.close();
}
{
  // 400% zoom of a 1280×1024 window, and a short landscape phone.
  for (const [name, viewport] of [["zoom400", { width: 320, height: 256 }], ["landscape", { width: 844, height: 390 }], ["tablet", { width: 768, height: 1024 }], ["wide1100", { width: 1100, height: 800 }]]) {
    const { ctx, page } = await context(viewport);
    await page.goto(`${BASE}/#whisperbook`);
    await enhanced(page);
    await shot(page, `${name}-whisperbook`);
    await ctx.close();
  }
}
for (const route of ["/work/wattch/", "/fr/work/wattch/", "/work/mcq-scan/", "/fr/work/mcq-scan/"]) {
  const { ctx, page } = await context(sizes.desktop);
  await page.goto(BASE + route);
  await shot(page, `case-${route.replace(/\//g, "-").replace(/^-|-$/g, "")}`);
  await ctx.close();
}
await browser.close();
writeFileSync(`${OUT}/capture-log.json`, JSON.stringify(log, null, 2));
const errors = log.filter(l => l.errors);
console.log(`\n${log.length} captures in ${OUT}; ${errors.length} with page errors`);
process.exit(errors.length ? 1 : 0);
