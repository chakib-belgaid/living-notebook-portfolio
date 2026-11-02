// P1: stills of every chapter cue in both hosts, after a direct jump and a settle.
// Usage: STUDY_URL=http://127.0.0.1:5311 node dev/motion-study-stills.mjs [outDir]
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.env.STUDY_URL ?? "http://127.0.0.1:5311";
const out = process.argv[2] ?? ".qa/p1/stills";
const only = process.env.CHAPTERS?.split(",");
mkdirSync(out, { recursive: true });
const hosts = [
  { name: "wide", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { name: "portrait", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
].filter((h) => !process.env.HOST || process.env.HOST === h.name);
const chapters = ["intro", "work", "bplog", "whisperbook", "energy-tools", "mcq-scan", "about", "contact"].filter((c) => !only || only.includes(c));
const browser = await chromium.launch();
const report = [];
for (const h of hosts) {
  const context = await browser.newContext({ ...h, name: undefined });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.error(h.name, "pageerror", e.message));
  await page.goto(`${base}/dev/motion-study.html`);
  await page.waitForFunction(() => document.documentElement.dataset.studyReady === "true", null, { timeout: 60000 });
  await page.waitForFunction(() => window.__study.adapter.isSettled(), null, { timeout: 30000 });
  for (const id of chapters) {
    await page.evaluate((id) => window.__study.jump(id), id);
    await page.waitForFunction(() => window.__study.adapter.isSettled(), null, { timeout: 30000 });
    await page.waitForTimeout(400);
    const file = `${out}/${h.name}-${id}.png`;
    await page.screenshot({ path: file });
    report.push({ host: h.name, chapter: id, file, progress: await page.evaluate(() => document.querySelector("#scene").dataset.progress) });
  }
  await context.close();
}
await browser.close();
writeFileSync(`${out}/stills.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
