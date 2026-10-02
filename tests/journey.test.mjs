import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { stops, stageProgress } from '../src/content.ts';

test('the phone journey visits Sketch, Blueprint, Build and Bloom in order', () => {
  assert.deepEqual(stops.map(s => s.name), ['sketch', 'blueprint', 'build', 'whisperbook', 'wattch', 'bloom']);
  assert.deepEqual(stops.map(s => s.stage), [0, 1, 2, 2, 2, 3]);
  assert.deepEqual(stops.map(s => s.spot), [null, 'about', null, 'whisperbook', 'wattch', null]);
  for (const s of stops) assert.equal(typeof stageProgress[s.stage], 'number');
  assert.deepEqual(stops.map(s => s.label), ['Sketch', 'Blueprint · Background', 'Build', 'Build · Whisperbook', 'Build · Wattch Core', 'Bloom · Write to me']);
});

test('six phone stills exist as WebP within the data budget', async () => {
  const dir = new URL('../public/assets/stills/', import.meta.url);
  const names = (await readdir(dir)).filter(n => n.endsWith('.webp')).sort();
  assert.deepEqual(names, ['bloom', 'blueprint', 'build', 'sketch', 'wattch', 'whisperbook'].map(n => `${n}.webp`));
  let total = 0;
  for (const name of names) {
    const file = await readFile(new URL(name, dir));
    assert.equal(file.toString('ascii', 0, 4), 'RIFF', name);
    assert.equal(file.toString('ascii', 8, 12), 'WEBP', name);
    assert.ok(file.length <= 100 * 1024, `${name} is ${file.length} bytes`);
    total += file.length;
  }
  assert.ok(total <= 600 * 1024, `stills total ${total} bytes`);
});
