// Every text the homepage renders, and every translated attribute (aria-label,
// alt, title, placeholder), has a French entry in
// src/translations.ts, unless it is a name, an address, a date range or a
// product identifier listed below. Run: node --test tests/translations.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPortfolio } from '../src/render.ts';
import { isLocale, resolveLocale, translate } from '../src/i18n.ts';
import { translations } from '../src/translations.ts';

/** Kept as written in every language. */
const untranslated = new Set([
  'Chakib Belgaid',
  'chakib.belgaid@gmail.com',
  'BP Log',
  'Whisperbook',
  'pyRAPL, pyJoules & Wattch',
  'MCQ Scan',
  'LinkedIn',
  'GitHub',
  // Employers in the career timeline.
  'Funecs',
  'Inria / Davidson Consulting',
]);
const isUntranslated = text =>
  untranslated.has(text)
  || /^\d{4}\s*[–-]\s*(\d{4}|present|today)?$/i.test(text) // year ranges
  || /^[↓↑→↗·]$/.test(text) // glyphs (aria-hidden icons)
  || /^https?:\/\//.test(text);

const decode = s => s.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e]));
const VOID = new Set(['img', 'input', 'br', 'meta', 'link', 'source', 'hr', 'wbr', 'area', 'base', 'col', 'embed', 'track']);
const ATTRIBUTES = ['aria-label', 'alt', 'title', 'placeholder', 'aria-valuetext'];

/** Text nodes and translated attributes outside script, style and [data-no-translate]. */
function translatable(html) {
  const found = [];
  const stack = []; // per open element: does it (or an ancestor) opt out?
  const skipped = () => stack.length > 0 && stack[stack.length - 1];
  const token = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = token.exec(html))) {
    const [, closing, name, attrs = '', selfClosing, text] = m;
    if (text !== undefined) {
      const value = decode(text).trim();
      if (value && !skipped()) found.push({ kind: 'text', value });
      continue;
    }
    if (!name) continue;
    const tag = name.toLowerCase();
    if (closing) { stack.pop(); continue; }
    const optOut = skipped() || /\sdata-no-translate\b/.test(attrs) || tag === 'script' || tag === 'style';
    if (!optOut) {
      for (const attr of ATTRIBUTES) {
        const a = attrs.match(new RegExp(`\\s${attr}="([^"]*)"`));
        if (a && decode(a[1]).trim()) found.push({ kind: attr, value: decode(a[1]).trim() });
      }
    }
    if (tag === 'script' || tag === 'style') {
      // Skip the raw body up to the closing tag.
      const end = html.indexOf(`</${tag}>`, token.lastIndex);
      token.lastIndex = end < 0 ? html.length : end + tag.length + 3;
      continue;
    }
    if (!selfClosing && !VOID.has(tag)) stack.push(optOut);
  }
  return found;
}

test('every rendered label and translated attribute has a translation', () => {
  const missing = [];
  const known = new Set(Object.keys(translations).map(key => key.toLowerCase()));
  for (const { kind, value } of translatable(renderPortfolio())) {
    if (isUntranslated(value)) continue;
    // French can match English (CV, Contact); templates can also translate
    // complete rendered messages that are not literal catalog keys.
    if (!known.has(value.toLowerCase()) && translate(value, 'fr') === value) missing.push(`${kind}: ${value}`);
  }
  assert.deepEqual([...new Set(missing)], []);
});

test('removed Arabic links and saved choices fall back to a supported language', () => {
  assert.equal(isLocale('ar'), false);
  assert.equal(resolveLocale('https://example.test/?lang=ar', 'ar', ['ar-DZ', 'fr-FR']), 'fr');
  assert.equal(resolveLocale('https://example.test/?lang=ar', 'ar', ['ar-DZ']), 'en');
  assert.equal(resolveLocale('https://example.test/?lang=ar', 'fr', ['en-US']), 'fr');
  assert.equal(resolveLocale('https://example.test/?lang=en', 'fr', ['fr-FR']), 'en');
  assert.equal(resolveLocale('https://example.test/?lang=fr', 'ar', ['en-US']), 'fr');
  assert.doesNotMatch(renderPortfolio(), /<option[^>]+value="ar"/);
});

test('French translations retain the live messages’ placeholders', () => {
  const placeholders = value => [...value.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
  for (const [source, french] of Object.entries(translations)) {
    assert.deepEqual(placeholders(french), placeholders(source), source);
  }
});

test('the extractor sees text, attributes and opt-outs', () => {
  const found = translatable('<p>One <b title="Two">Three</b></p><span data-no-translate>Four <i>Five</i></span><img alt="Six" /><script>var x = "<b>Seven</b>"</script><a aria-label="Eight">Nine</a>');
  assert.deepEqual(found.map(f => f.value), ['One', 'Two', 'Three', 'Six', 'Eight', 'Nine']);
});
