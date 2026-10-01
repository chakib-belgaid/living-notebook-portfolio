import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTransferEstimate } from '../src/transfer.ts';

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
