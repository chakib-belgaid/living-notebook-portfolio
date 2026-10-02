import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stops, stageProgress } from '../src/content.ts';

test('the phone journey visits Sketch, Blueprint, Build and Bloom in order', () => {
  assert.deepEqual(stops.map(s => s.name), ['sketch', 'blueprint', 'build', 'whisperbook', 'wattch', 'bloom']);
  assert.deepEqual(stops.map(s => s.stage), [0, 1, 2, 2, 2, 3]);
  assert.deepEqual(stops.map(s => s.spot), [null, 'about', null, 'whisperbook', 'wattch', null]);
  for (const s of stops) assert.equal(typeof stageProgress[s.stage], 'number');
  assert.deepEqual(stops.map(s => s.label), ['Sketch', 'Blueprint · Background', 'Build', 'Build · Whisperbook', 'Build · Wattch Core', 'Bloom · Write to me']);
});
