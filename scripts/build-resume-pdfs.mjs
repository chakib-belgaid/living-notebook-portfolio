/**
 * Regenerates the public short-CV PDFs from their maintained HTML editions.
 *
 *   npm run resume:pdf        (or: node scripts/build-resume-pdfs.mjs, from the repo root)
 *
 * Reads  public/resume/chakib-belgaid-product-engineer-{en,fr}.html (+ resume.css)
 * Writes public/resume/chakib-belgaid-product-engineer-{en,fr}.pdf
 *
 * This is the only supported PDF build path. It prints the HTML with Playwright
 * Chromium (A4, print CSS from resume.css, backgrounds on, page footer with the
 * edition label and page number). The former ReportLab script was removed because
 * it flattened en/em dashes to hyphens and left a dangling separator in the contact line.
 *
 * Requires `npm ci` (playwright devDependency) and an installed Chromium.
 * Edit the HTML, not the PDFs; re-run this script and commit both together.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(repoRoot, 'public');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.pdf': 'application/pdf' };

// resume.css is referenced as /resume/resume.css, so serve public/ as the site root.
const server = http.createServer((req, res) => {
  const file = path.join(publicDir, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(publicDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const { port } = server.address();

const footerLabel = {
  en: 'Chakib Belgaid | October 2026',
  fr: 'Chakib Belgaid | Octobre 2026',
};

const browser = await chromium.launch();
try {
  for (const lang of ['en', 'fr']) {
    const name = `chakib-belgaid-product-engineer-${lang}`;
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/resume/${name}.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'print' });
    const out = path.join(publicDir, 'resume', `${name}.pdf`);
    await page.pdf({
      path: out,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font-size:8px;color:#53686d;font-family:Helvetica,Arial,sans-serif;padding:0 14mm;display:flex;justify-content:space-between"><span>${footerLabel[lang]}</span><span class="pageNumber"></span></div>`,
    });
    await page.close();
    console.log(`wrote ${path.relative(repoRoot, out)} (${fs.statSync(out).size} bytes)`);
  }
} finally {
  await browser.close();
  server.close();
}
