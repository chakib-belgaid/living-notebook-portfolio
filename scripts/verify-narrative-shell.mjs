// P2 narrative-shell checks. Build, serve dist with `npx vite preview --host
// 127.0.0.1 --port 4317 --strictPort`, then `node scripts/verify-narrative-shell.mjs`
// (BASE overrides the URL). Writes captures to .qa/p2/ (gitignored).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { WIDE_LAYOUT_QUERY as WIDE } from "../src/narrative/model.ts";
const BASE = process.env.BASE ?? "http://127.0.0.1:4317";
const OUT = ".qa/p2";
mkdirSync(OUT, { recursive: true });
const ids = ["intro", "work", "bplog", "whisperbook", "energy-tools", "mcq-scan", "about", "contact"];
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };

const browser = await chromium.launch();
const sizes = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

for (const [label, viewport] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ viewport, javaScriptEnabled: false, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready.then(() => document.fonts.status));
  const order =await page.$$eval("main > section.chapter", s => s.map(x => x.id));
  check(`${label} no-JS: eight chapters in order`, JSON.stringify(order) === JSON.stringify(ids), order.join(","));
  const text = await page.locator("main").innerText();
  const anchors = ["I turn AI ideas into useful products.", "From an idea to something useful.", "A small AI system for an everyday problem.", "Books I could listen to, on my own terms.", "Making energy measurement usable.", "The client’s cloud. A workable path to shipping.", "Product building, research, and applied AI.", "Let’s talk about what you’re building."];
  let last = -1, inOrder = true;
  for (const a of anchors) { const i = text.indexOf(a); if (i <= last) inOrder = false; last = i; }
  check(`${label} no-JS: chapter copy visible in order`, inOrder);
  check(`${label} no-JS: one h1`, (await page.locator("h1").count()) === 1);
  const navLinks = await page.$$eval(".nav-sections a", as => as.map(a => `${a.textContent}:${a.getAttribute("href")}`));
  check(`${label} no-JS: nav links`, navLinks.join() === "Work:#work,About:#about,Contact:#contact", navLinks.join());
  const inView = async sel => {
    const box = await page.locator(sel).first().boundingBox();
    return !!box && box.y >= 0 && box.y + box.height <= viewport.height && box.x >= 0 && box.x + box.width <= viewport.width;
  };
  check(`${label} first viewport: role line`, await inView("#intro .chapter-label"));
  check(`${label} first viewport: h1`, await inView("h1"));
  check(`${label} first viewport: CV link`, await inView(".cv-link"));
  check(`${label} CV link visible`, await page.locator(".cv-link").isVisible());
  check(`${label} skip link present`, (await page.locator("a.skip-link[href='#intro']").count()) === 1);
  const hosts = page.locator(".chapter [data-scene-host]");
  const hostIds = await hosts.evaluateAll(hs => hs.map(h => h.dataset.sceneHost));
  check(`${label} eight chapter hosts, one per chapter, each with a poster`, JSON.stringify(hostIds) === JSON.stringify(ids)
    && (await page.locator(".chapter [data-scene-host] > img.scene-poster").count()) === 8);
  check(`${label} exactly one rail`, (await page.locator('[data-scene-host="rail"]').count()) === 1);
  const hostHeights = await hosts.evaluateAll(hs => hs.map(h => Math.round(h.getBoundingClientRect().height)));
  const railBox = await page.locator('[data-scene-host="rail"]').boundingBox();
  const wide = await page.evaluate(q => matchMedia(q).matches, WIDE);
  if (label === "desktop") {
    check(`${label} wide layout active`, wide);
    check(`${label} chapter hosts not displayed on wide`, hostHeights.every(h => h === 0), hostHeights.join(","));
    check(`${label} rail reserves its size`, !!railBox && railBox.height >= 600 && railBox.width >= viewport.width * 0.45, JSON.stringify(railBox));
  } else {
    check(`${label} narrow layout active`, !wide);
    check(`${label} chapter hosts reserve height`, hostHeights.every(h => h >= 300), hostHeights.join(","));
    check(`${label} rail not displayed on narrow`, railBox === null);
  }
  // Every poster decodes once its host (or the rail) is scrolled into view.
  const posterTargets = label === "desktop" ? [page.locator('[data-scene-host="rail"]')] : await hosts.all();
  let decoded = 0;
  for (const host of posterTargets) {
    await host.scrollIntoViewIfNeeded();
    const img = host.locator("img");
    await page.waitForFunction(el => el.complete && el.naturalWidth > 0, await img.elementHandle(), { timeout: 5000 }).catch(() => {});
    if ((await img.evaluate(el => el.naturalWidth)) === 780) decoded++;
  }
  check(`${label} posters decode`, decoded === posterTargets.length, `${decoded}/${posterTargets.length}`);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${OUT}/nojs-${label}-first.png` });
  await page.screenshot({ path: `${OUT}/nojs-${label}-full.png`, fullPage: true });
  // Banned release-1 actions and routes.
  const html = await page.content();
  check(`${label} no release-2 routes or finished-house action`, !/\/work\/(bp-log|whisperbook|energy-tools)\/|Explore the finished house/.test(html));
  await ctx.close();

  // Fragments without JavaScript.
  // [fragment, chapter or element landed on, first visible line that must clear the header]
  const fragments = [
    ["work", "#work", "#work-title"],
    ["bplog", "#bplog", "#bplog .chapter-label"],
    ["whisperbook", "#whisperbook", "#whisperbook .chapter-label"],
    ["wattch", "#energy-tools", "#energy-tools .chapter-label"],
    ["energy-tools", "#energy-tools", "#energy-tools .chapter-label"],
    ["mcq-scan", "#mcq-scan", "#mcq-scan .chapter-label"],
    ["workshop", "#workshop", "#workshop-title"],
    ["about", "#about", "#about-title"],
    ["contact", "#contact", "#contact-title"],
  ];
  let railTop = null;
  for (const [frag, target, firstLine] of fragments) {
    const c = await browser.newContext({ viewport, javaScriptEnabled: false });
    const p = await c.newPage();
    await p.goto(`${BASE}/#${frag}`, { waitUntil: "load" });
    // Measure after the Newsreader swap, the late layout change that could
    // move a target after the browser's initial fragment scroll.
    await p.evaluate(() => document.fonts.ready.then(() => document.fonts.status));
    await p.waitForTimeout(250);
    const y = await p.evaluate(() => scrollY);
    const header = await p.locator(".masthead").boundingBox();
    const headerBottom = header.y + header.height;
    const box = await p.locator(target).boundingBox();
    const line = await p.locator(firstLine).boundingBox();
    // The target is at the top of the viewport and its first line of text is
    // entirely below the sticky header.
    const ok = y > 0 && box && line && box.y >= headerBottom - 1 && box.y < viewport.height * 0.5 && line.y >= headerBottom && line.y + line.height <= viewport.height;
    check(`${label} no-JS fragment #${frag} lands on ${target}, ${firstLine} clear of header`, !!ok,
      `scrollY=${Math.round(y)} header=${Math.round(headerBottom)} target=${Math.round(box?.y ?? -1)} line=${Math.round(line?.y ?? -1)}`);
    if (label === "desktop") {
      const rail = await p.locator('[data-scene-host="rail"]').boundingBox();
      if (railTop === null) railTop = rail?.y ?? null;
      check(`${label} rail stays put at #${frag}`, !!rail && Math.abs(rail.y - railTop) < 1 && rail.y >= headerBottom && rail.y + rail.height <= viewport.height, `railTop=${Math.round(rail?.y ?? -1)}`);
    }
    await p.screenshot({ path: `${OUT}/nojs-${label}-fragment-${frag}.png` });
    await c.close();
  }
}

// With JavaScript: locale switching.
let englishTexts;
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "load" });
  englishTexts = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.querySelector("#app"), NodeFilter.SHOW_TEXT);
    const out = [];
    while (walker.nextNode()) out.push(walker.currentNode.data.trim());
    return out;
  });
  await ctx.close();
}
for (const [label, viewport] of Object.entries(sizes)) {
  for (const lang of ["fr", "ar"]) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));
    await page.goto(`${BASE}/?lang=${lang}`, { waitUntil: "load" });
    await page.waitForFunction(() => document.documentElement.classList.contains("enhanced"));
    const h1 = await page.locator("h1").innerText();
    const nav = await page.$$eval(".nav-sections a", as => as.map(a => a.textContent).join("|"));
    const dir = await page.evaluate(() => document.documentElement.dir);
    const cv = await page.locator(".cv-link").evaluate(a => `${a.textContent} ${a.getAttribute("href")} ${a.hreflang}`);
    const title = await page.title();
    const expectH1 = lang === "fr" ? "Je transforme des idées d’IA en produits utiles." : "أحوّل أفكار الذكاء الاصطناعي إلى منتجات مفيدة.";
    check(`${label} ?lang=${lang} h1 translated`, h1 === expectH1, h1);
    check(`${label} ?lang=${lang} nav translated`, lang === "fr" ? nav === "Projets|Parcours|Contact" : nav === "الأعمال|نبذة عني|تواصل", nav);
    check(`${label} ?lang=${lang} dir`, dir === (lang === "ar" ? "rtl" : "ltr"), dir);
    check(`${label} ?lang=${lang} CV link`, lang === "fr" ? cv.includes("-fr.pdf fr") : cv.includes("-en.pdf en") && cv.includes("بالإنجليزية"), cv);
    check(`${label} ?lang=${lang} title translated`, !title.includes("Applied AI"), title);
    check(`${label} ?lang=${lang} no page errors`, errors.length === 0, errors.join("; "));
    const caseHref = await page.locator("#whisperbook a.action-case").getAttribute("href");
    check(`${label} ?lang=${lang} case link`, caseHref === (lang === "fr" ? "/fr/work/whispbook/" : "/work/whispbook/"), caseHref);
    // Text nodes still identical to the English page, minus names, product
    // identifiers and words that are the same in French.
    const texts = () => {
      const walker = document.createTreeWalker(document.querySelector("#app"), NodeFilter.SHOW_TEXT);
      const out = [];
      while (walker.nextNode()) out.push(walker.currentNode.data.trim());
      return out;
    };
    const localized = await page.evaluate(texts);
    const untranslated = localized.filter((t, i) => t && t === englishTexts[i]
      && !/^(Chakib Belgaid|BP Log|Whisperbook|pyRAPL, pyJoules & Wattch|MCQ Scan|LinkedIn|Funecs|Inria \/ Davidson Consulting|EN|FR|AR|chakib\.belgaid@gmail\.com|[\d–]+|[↓↗→↑·])$/.test(t)
      && !(lang === "fr" && /^(CV|Contact)$/.test(t)));
    check(`${label} ?lang=${lang} no English text left`, localized.length === englishTexts.length && untranslated.length === 0, untranslated.join(" | "));
    await page.screenshot({ path: `${OUT}/js-${label}-${lang}-first.png` });
    if (label === "mobile") await page.screenshot({ path: `${OUT}/js-${label}-${lang}-full.png`, fullPage: true });
    await ctx.close();
  }
}
// JS English desktop capture for comparison.
{
  const ctx = await browser.newContext({ viewport: sizes.desktop });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(`${BASE}/?lang=en`, { waitUntil: "load" });
  check("desktop JS en: no page errors", errors.length === 0, errors.join("; "));
  await page.locator("#whisperbook").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/js-desktop-en-whisperbook.png` });
  await ctx.close();
}
await browser.close();
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
