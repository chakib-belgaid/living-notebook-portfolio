// Retained-case dependency check (ACCEPTANCE F8a). Builds a clean output
// directory (removing any previous one, so no old Pages file can answer),
// serves it with `vite preview`, and checks the six case routes and both
// /live/ redirects: every local dependency answers with the right content
// type (the preview answers HTML 200 for a missing file, so status alone
// proves nothing), every image decodes, the EN/FR hreflang pairs match, the
// six restored case images and the six self-hosted social cards are built,
// referenced and decode, and no legacy web font is referenced.
//   node scripts/verify-case-dependencies.mjs
//   DIST=.qa/agent-cases/dist PORT=5212 node scripts/verify-case-dependencies.mjs
// (PORT overrides 4319; DIST overrides dist, the build and preview directory.)
import { chromium } from "playwright";
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";

const PORT = Number(process.env.PORT ?? 4319);
const DIST = process.env.DIST ?? "dist";
const BASE = `http://127.0.0.1:${PORT}`;
const SITE = "https://chakib-belgaid.github.io";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };

// The restored case evidence and the per-case social cards, all self-hosted.
const caseImages = {
  whispbook: ["/assets/projects/whisperbook/now-playing.webp", "/assets/projects/whisperbook/read-along.webp", "/assets/projects/whisperbook/voice-cast.webp", "/assets/projects/whisperbook/library.webp"],
  wattch: ["/assets/projects/wattch/deterministic-trace.png", "/assets/projects/wattch/energy-tests.png"],
  "mcq-scan": [],
};
const socialCard = (slug, lang) => `/assets/social/${slug}-${lang}.png`;
const socialCards = Object.keys(caseImages).flatMap(slug => ["en", "fr"].map(lang => socialCard(slug, lang)));

rmSync(DIST, { recursive: true, force: true });
execSync(`npx tsc --noEmit && npx vite build --outDir ${JSON.stringify(DIST)} --emptyOutDir`, { stdio: "ignore" });
check("clean build", existsSync(`${DIST}/index.html`), DIST);
const missingFiles = [...Object.values(caseImages).flat(), ...socialCards].filter(p => !existsSync(DIST + p));
check("build contains the six case images and six social cards", missingFiles.length === 0, missingFiles.join(", "));
check("no legacy web fonts in the build", !existsSync(`${DIST}/social`) && !readFileSync(`${DIST}/assets/legacy-evidence.css`, "utf8").includes("url(")
  && !readFileSync(`${DIST}/assets/legacy-evidence.css`, "utf8").includes("@font-face"));

const server = spawn("npx", ["vite", "preview", "--outDir", DIST, "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true });
// The preview runs in its own process group: stop npx and vite together.
const stop = () => { try { process.kill(-server.pid, "SIGTERM"); } catch { /* already gone */ } };
for (let i = 0; i < 50; i++) {
  try { await fetch(BASE + "/"); break; } catch { await new Promise(r => setTimeout(r, 200)); }
}

const cases = {
  "/work/whispbook/": { lang: "en", slug: "whispbook", pair: "/fr/work/whispbook/", chapter: "whisperbook", project: /Whisperbook/, android: true },
  "/fr/work/whispbook/": { lang: "fr", slug: "whispbook", pair: "/work/whispbook/", chapter: "whisperbook", project: /Whisperbook/, android: true },
  "/work/wattch/": { lang: "en", slug: "wattch", pair: "/fr/work/wattch/", chapter: "energy-tools", project: /Wattch/ },
  "/fr/work/wattch/": { lang: "fr", slug: "wattch", pair: "/work/wattch/", chapter: "energy-tools", project: /Wattch/ },
  "/work/mcq-scan/": { lang: "en", slug: "mcq-scan", pair: "/fr/work/mcq-scan/", chapter: "mcq-scan", project: /MCQ Scan/ },
  "/fr/work/mcq-scan/": { lang: "fr", slug: "mcq-scan", pair: "/work/mcq-scan/", chapter: "mcq-scan", project: /MCQ Scan/ },
};
const redirects = { "/live/": "/?view=read&lang=en", "/fr/live/": "/?view=read&lang=fr" };

/** Expected content type for a local path, by extension or role. */
function expectedType(path) {
  if (/\.css$/.test(path)) return /^text\/css/;
  if (/\.m?js$/.test(path)) return /javascript/;
  if (/\.svg$/.test(path)) return /^image\/svg\+xml/;
  if (/\.png$/.test(path)) return /^image\/png/;
  if (/\.webp$/.test(path)) return /^image\/webp/;
  if (/\.woff2$/.test(path)) return /^font\/woff2/;
  if (/\.pdf$/.test(path)) return /^application\/pdf/;
  if (/\.txt$/.test(path)) return /^text\/plain/;
  return /^text\/html/;
}
const localPath = ref => {
  if (!ref || ref.startsWith("#") || ref.startsWith("mailto:")) return null;
  const url = new URL(ref, BASE + "/");
  if (url.origin === BASE) return url.pathname;
  if (url.origin === SITE) return url.pathname; // absolute self-links in metadata
  return null;
};
async function dependency(path, from) {
  const response = await fetch(BASE + path);
  const type = response.headers.get("content-type") ?? "";
  const body = await response.text();
  let ok = response.ok && expectedType(path).test(type);
  // An HTML route must be that route, not the homepage fallback.
  if (ok && /^text\/html/.test(type)) {
    if (cases[path]) ok = body.includes(`data-prerendered-route="${path.replace(/\/$/, "")}"`);
    else if (path === "/") ok = body.includes('id="portfolio"');
    else if (redirects[path]) ok = body.includes("http-equiv=\"refresh\"");
  }
  check(`${from} → ${path}`, ok, `${response.status} ${type}`);
  return body;
}

try {
  for (const [route, info] of Object.entries(cases)) {
    const html = await dependency(route, "route");
    const refs = new Set();
    for (const m of html.matchAll(/<(?:link|script|img|a|source)\b[^>]*?\b(?:href|src)="([^"]+)"/g)) refs.add(m[1].replace(/&amp;/g, "&"));
    for (const m of html.matchAll(/<meta (?:property|name)="(?:og|twitter):image" content="([^"]+)"/g)) refs.add(m[1]);
    const local = [...refs].map(localPath).filter(Boolean);
    for (const path of new Set(local.map(p => p.replace(/\/$/, "/")))) {
      const body = await dependency(path, route);
      if (/\.css$/.test(path)) for (const m of body.matchAll(/url\(([^)]+)\)/g)) await dependency(localPath(m[1].replace(/["']/g, "")), path);
    }
    check(`${route} no legacy web fonts`, !/\.woff2?\b|jersey-10|ibm-plex/i.test(html.replace(/<style[\s\S]*?<\/style>/g, "")) && !/@font-face/.test(html));
    const images = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
    const srcOf = tag => tag.match(/\bsrc="([^"]+)"/)?.[1];
    const want = caseImages[info.slug];
    const found = images.map(srcOf);
    check(`${route} references its case images`, want.every(p => found.includes(p)) && found.filter(p => p?.startsWith("/assets/projects/")).every(p => want.includes(p)), found.join(", "));
    const unsized = images.filter(tag => !/\bwidth="\d+"/.test(tag) || !/\bheight="\d+"/.test(tag));
    check(`${route} images reserve their dimensions`, unsized.length === 0, unsized.join(" "));
    const card = SITE + socialCard(info.slug, info.lang);
    const meta = name => html.match(new RegExp(`<meta (?:property|name)="${name}" content="([^"]+)">`))?.[1];
    check(`${route} og/twitter image is its own social card`, meta("og:image") === card && meta("twitter:image") === card
      && meta("og:image:type") === "image/png" && meta("og:image:width") === "1200" && meta("og:image:height") === "630",
      `${meta("og:image")} ${meta("og:image:width")}x${meta("og:image:height")}`);
    check(`${route} keeps its project identity`, info.project.test(html) && (!info.android || /Android/.test(html)));
    const alternates = Object.fromEntries([...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m => [m[1], m[2]]));
    const en = info.lang === "en" ? route : info.pair;
    const fr = info.lang === "fr" ? route : info.pair;
    check(`${route} hreflang en/fr/x-default`, alternates.en === SITE + en && alternates.fr === SITE + fr && alternates["x-default"] === SITE + en, JSON.stringify(alternates));
    check(`${route} canonical is itself`, html.includes(`<link rel="canonical" href="${SITE}${route}">`));
    const expectedReturn = info.lang === "fr" ? `/?lang=fr#${info.chapter}` : `/#${info.chapter}`;
    const returns = [...html.matchAll(/<a [^>]*href="([^"]+)" data-return="([^"]+)"/g)].map(m => `${m[1]}|${m[2]}`);
    check(`${route} Return links (top and bottom)`, returns.length === 2 && returns.every(r => r === `${expectedReturn}|${info.chapter}`), returns.join(" "));
    check(`${route} never forces view=read`, !html.includes("view=read"));
  }
  for (const [route, target] of Object.entries(redirects)) {
    const html = await dependency(route, "route");
    check(`${route} redirects to ${target}`, html.includes(`url=${target.replace("&", "&amp;")}`));
  }

  // In the browser: every response has the right type and every image decodes.
  const browser = await chromium.launch();
  for (const route of [...Object.keys(cases), ...Object.keys(redirects)]) {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport });
      const bad = [];
      const errors = [];
      page.on("pageerror", e => errors.push(String(e)));
      page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
      page.on("requestfailed", r => bad.push(`failed ${r.url()}`));
      page.on("response", async r => {
        const url = new URL(r.url());
        if (url.origin !== BASE) return;
        const type = r.headers()["content-type"] ?? "";
        const kind = r.request().resourceType();
        const want = { stylesheet: /text\/css/, script: /javascript/, image: /^image\//, font: /^font\// }[kind] ?? (kind === "document" ? /text\/html/ : /./);
        if (!want.test(type)) bad.push(`${kind} ${url.pathname} ${type}`);
      });
      await page.goto(BASE + route, { waitUntil: "load" });
      if (redirects[route]) await page.waitForURL(u => u.pathname === "/" && u.search.includes("view=read"), { timeout: 5000 });
      // Bring every image into view (lazy ones load only then) and wait for
      // each to settle; decode() of an image that never loads would not.
      // Images that are not rendered (the homepage's per-chapter posters on
      // a wide layout) are not requested and not counted.
      for (const handle of await page.$$("img")) {
        if (!(await handle.evaluate(i => i.getClientRects().length > 0))) continue;
        await handle.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        await handle.evaluate(i => i.complete || new Promise(r => { i.addEventListener("load", r, { once: true }); i.addEventListener("error", r, { once: true }); setTimeout(r, 4000); }));
      }
      const images = await page.evaluate(() => [...document.images].filter(i => i.getClientRects().length > 0).map(i => ({ src: i.getAttribute("src"), w: i.naturalWidth, loading: i.loading })));
      const undecoded = images.filter(i => i.w === 0);
      const label = `${route} @${viewport.width}`;
      check(`${label} responses typed correctly`, bad.length === 0, bad.join("; "));
      check(`${label} images decode (${images.length})`, undecoded.length === 0, undecoded.map(i => i.src).join(", "));
      check(`${label} no page or console errors`, errors.length === 0, errors.join("; "));
      if (redirects[route]) check(`${label} lands on readable content`, await page.locator("h1").isVisible());
      else check(`${label} no horizontal page scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.close();
    }
  }
  // Every social card and case image decodes at its stated size.
  const page = await browser.newPage();
  await page.goto(BASE + "/work/mcq-scan/", { waitUntil: "load" });
  const sizes = { "now-playing": [941, 1672], "read-along": [941, 1672], "voice-cast": [941, 1672], library: [941, 1672], "deterministic-trace": [1600, 1000], "energy-tests": [1440, 900] };
  for (const path of [...socialCards, ...Object.values(caseImages).flat()]) {
    const size = await page.evaluate(src => new Promise(resolve => {
      const img = new Image();
      img.onload = () => img.decode().then(() => resolve([img.naturalWidth, img.naturalHeight]), () => resolve([0, 0]));
      img.onerror = () => resolve([0, 0]);
      img.src = src;
    }), path);
    const name = path.split("/").pop().replace(/\.\w+$/, "");
    const expected = path.startsWith("/assets/social/") ? [1200, 630] : sizes[name];
    check(`${path} decodes at ${expected.join("×")}`, size[0] === expected[0] && size[1] === expected[1], size.join("×"));
  }
  await page.close();
  await browser.close();
} finally {
  stop();
}
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
