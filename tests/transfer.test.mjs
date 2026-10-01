import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTransferEstimate, formatGrams } from '../src/transfer.ts';
import { estimateCompute, GRID_INTENSITY } from '../src/compute.ts';

test('reported bytes, confirmed cache hits and hidden cross-origin sizes stay distinct', () => {
  const original = globalThis.PerformanceObserver;
  let report;
  globalThis.PerformanceObserver = class {
    static supportedEntryTypes = ['resource','navigation'];
    constructor(callback) { report = entries => callback({getEntries: () => entries}); }
    observe() {}
    disconnect() {}
  };
  try {
    const estimate = createTransferEstimate();
    report([{transferSize:0,decodedBodySize:0}]);
    assert.equal(estimate.read().figure, 'Unavailable');
    report([{transferSize:0,decodedBodySize:1200}, {transferSize:1e6,decodedBodySize:900000}]);
    assert.equal(estimate.read().figure, '0.15 g CO₂e');
    assert.equal(estimate.read().source, '1.00 MB reported · 1 cached resources · 1 sizes unknown.');
    estimate.dispose();
  } finally { globalThis.PerformanceObserver = original; }
});

test('an unavailable Resource Timing API cannot present a zero estimate', () => {
  const original = globalThis.PerformanceObserver;
  globalThis.PerformanceObserver = undefined;
  try {
    const estimate = createTransferEstimate();
    assert.equal(estimate.read().figure, 'Unavailable');
    assert.match(estimate.read().source, /unavailable/);
    estimate.dispose();
  } finally {globalThis.PerformanceObserver = original;}
});

test('rendering time becomes energy at the assumed power and co2.js world grid intensity', () => {
  // One hour of CPU and GPU is 30 Wh at 10 W + 20 W.
  const hour = 3.6e6;
  const estimate = estimateCompute({cpuMs: hour, gpuMs: hour});
  assert.ok(Math.abs(estimate.grams - 0.03 * GRID_INTENSITY) < 1e-9);
  assert.match(estimate.source, /3600\.0 s CPU · 3600\.0 s GPU\.$/);
});

test('missing GPU timers count the CPU alone and say so; no renderer is unavailable', () => {
  const estimate = estimateCompute({cpuMs: 1000, gpuMs: null});
  assert.ok(Math.abs(estimate.grams - 10 / 3.6e6 * GRID_INTENSITY) < 1e-12);
  assert.equal(estimate.figure, '1.3 mg CO₂e');
  assert.match(estimate.source, /GPU time not exposed/);
  assert.equal(estimateCompute(null).figure, 'Unavailable');
  assert.equal(estimateCompute(null).grams, null);
});

test('small footprints read in milligrams', () => {
  assert.equal(formatGrams(0.15), '0.15 g CO₂e');
  assert.equal(formatGrams(0.0042), '4.2 mg CO₂e');
  assert.equal(formatGrams(0.00042), '0.42 mg CO₂e');
  assert.equal(formatGrams(0), 'Under 0.01 mg CO₂e');
});
