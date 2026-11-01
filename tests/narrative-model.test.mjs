// Pure checks of the narrative model, URL helpers and return records.
// Run: node --test tests/narrative-model.test.mjs (Node strips the types).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chapterIds, resolveFragment, nextChapterId, activeNavHref, fragmentAliases, chapterOrder } from '../src/narrative/model.ts';
import { chapters } from '../src/narrative/content.ts';
import { hrefForTarget, inPageDestination, isCaseLink } from '../src/navigation.ts';
import { parseReturnRecord, parseRestoreRecord, returnQuery, caseKey, CASE_PATH, RESTORE_TTL_MS } from '../src/narrative/return-state.ts';

test('resolveFragment: empty and #intro are the opening', () => {
  assert.deepEqual(resolveFragment(''), { chapter: 'intro', target: 'intro' });
  assert.deepEqual(resolveFragment('#'), { chapter: 'intro', target: 'intro' });
  assert.deepEqual(resolveFragment('#intro'), { chapter: 'intro', target: 'intro' });
});

test('resolveFragment: every canonical chapter, with or without #', () => {
  for (const id of chapterIds) {
    assert.deepEqual(resolveFragment(`#${id}`), { chapter: id, target: id });
    assert.deepEqual(resolveFragment(id), { chapter: id, target: id });
  }
});

test('resolveFragment: legacy aliases land on their chapters and their own anchors', () => {
  assert.deepEqual(resolveFragment('#wattch'), { chapter: 'energy-tools', target: 'wattch' });
  // #workshop is the notebook near About, never MCQ Scan.
  assert.deepEqual(resolveFragment('#workshop'), { chapter: 'about', target: 'workshop' });
  assert.deepEqual(Object.keys(fragmentAliases).sort(), ['wattch', 'workshop']);
});

test('resolveFragment: unknown, case-only and prototype names resolve to nothing', () => {
  for (const hash of ['#nope', '#whispbook', '#Work', '#constructor', '#toString', '#__proto__', '#context']) {
    assert.equal(resolveFragment(hash), null, hash);
  }
  // Percent-encoded ids are decoded once.
  assert.deepEqual(resolveFragment('#energy%2Dtools'), { chapter: 'energy-tools', target: 'energy-tools' });
});

test('chapter order and nextChapterId', () => {
  assert.deepEqual([...chapterIds], ['intro', 'work', 'bplog', 'whisperbook', 'energy-tools', 'mcq-scan', 'about', 'contact']);
  assert.deepEqual(chapters.map(c => c.id), [...chapterIds]);
  assert.equal(nextChapterId('intro'), 'work');
  assert.equal(nextChapterId('whisperbook'), 'energy-tools');
  assert.equal(nextChapterId('about'), 'contact');
  assert.equal(nextChapterId('contact'), null);
  assert.equal(chapterOrder('mcq-scan'), 5);
});

test('activeNavHref: Work covers the index and the four work chapters', () => {
  assert.equal(activeNavHref('intro'), null);
  for (const id of ['work', 'bplog', 'whisperbook', 'energy-tools', 'mcq-scan']) assert.equal(activeNavHref(id), '#work', id);
  assert.equal(activeNavHref('about'), '#about');
  assert.equal(activeNavHref('contact'), '#contact');
});

test('scene progress follows the P1-tuned values and increases through the story', () => {
  const progress = Object.fromEntries(chapters.map(c => [c.id, c.scene.progress]));
  assert.deepEqual(progress, { intro: 0, work: 0.4, bplog: 0.52, whisperbook: 0.66, 'energy-tools': 0.76, 'mcq-scan': 0.84, about: 0.93, contact: 1 });
});

test('hrefForTarget keeps every query parameter and drops the hash for the opening', () => {
  const current = 'https://example.test/?view=garden&lang=fr&quality=low&utm_source=x#work';
  assert.equal(hrefForTarget(current, 'wattch'), 'https://example.test/?view=garden&lang=fr&quality=low&utm_source=x#wattch');
  assert.equal(hrefForTarget(current, 'intro'), 'https://example.test/?view=garden&lang=fr&quality=low&utm_source=x');
});

test('inPageDestination takes over same-document chapter links only', () => {
  const here = 'https://example.test/?lang=ar#intro';
  assert.deepEqual(inPageDestination('#whisperbook', here), { chapter: 'whisperbook', target: 'whisperbook' });
  assert.deepEqual(inPageDestination('/?lang=ar#workshop', here), { chapter: 'about', target: 'workshop' });
  assert.equal(inPageDestination('/?lang=fr#work', here), null, 'another query is another document');
  assert.equal(inPageDestination('/work/whispbook/', here), null);
  assert.equal(inPageDestination('https://github.com/x#work', here), null);
  assert.equal(inPageDestination('#unknown', here), null);
});

test('case links: the retained routes in both languages, same origin only', () => {
  const here = 'https://example.test/';
  for (const path of ['/work/whispbook/', '/fr/work/whispbook/', '/work/wattch/', '/fr/work/mcq-scan/', '/work/mcq-scan']) assert.ok(isCaseLink(path, here), path);
  for (const path of ['/resume/x.pdf', 'https://evil.test/work/whispbook/', '/work/', '/ar/work/whispbook/']) assert.ok(!isCaseLink(path, here), path);
  assert.ok(CASE_PATH.test('/work/wattch/'));
  assert.equal(caseKey('/fr/work/whispbook'), 'notebook:return:/fr/work/whispbook/');
});

test('return records are validated, never trusted', () => {
  const good = { v: 1, chapter: 'whisperbook', offset: 0.4, query: '?view=garden&lang=fr' };
  assert.deepEqual(parseReturnRecord(JSON.stringify(good)), good);
  assert.equal(parseReturnRecord(null), null);
  assert.equal(parseReturnRecord('{oops'), null);
  for (const bad of [
    { ...good, v: 2 }, { ...good, chapter: 'whispbook' }, { ...good, offset: 1.5 }, { ...good, offset: -0.1 },
    { ...good, offset: 'NaN' }, { ...good, query: 'https://evil.test/' }, { ...good, query: '?' + 'x'.repeat(600) },
  ]) assert.equal(parseReturnRecord(JSON.stringify(bad)), null, JSON.stringify(bad).slice(0, 80));
  assert.equal(returnQuery(''), '');
  assert.equal(returnQuery('?'), '');
  assert.equal(returnQuery('?lang=fr'), '?lang=fr');
  assert.equal(returnQuery('?' + 'x'.repeat(600)), '');
});

test('restore records expire', () => {
  const now = 1_000_000;
  const record = { v: 1, chapter: 'whisperbook', offset: 0.25, t: now - 1000 };
  assert.deepEqual(parseRestoreRecord(JSON.stringify(record), now), record);
  assert.equal(parseRestoreRecord(JSON.stringify({ ...record, t: now - RESTORE_TTL_MS - 1 }), now), null);
  assert.equal(parseRestoreRecord(JSON.stringify({ ...record, t: now + 5000 }), now), null);
  assert.equal(parseRestoreRecord(JSON.stringify({ ...record, chapter: 'garden' }), now), null);
});
