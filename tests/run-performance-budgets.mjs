import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Run the hardware-dependent limits explicitly, one browser at a time,
// against a production preview (TEST_URL). No limit is relaxed to accommodate
// a software renderer. Two parts, and the run fails if either fails:
//   1. Animation lifecycle checks (tests/scene-lifecycle.test.mjs), selected by name:
//      continuous visible animation, the hidden tab, the still preferences and
//      pause. A pattern that selects nothing fails the run instead of passing
//      with zero tests.
//   2. The exploration budgets (tests/performance.mjs with
//      PERFORMANCE_BUDGETS=1): place labels answer hover, focus and Tab within
//      100 ms in normal and reduced motion; more than 20 garden frames per
//      second while exploring and after pause and resume; more than 10 frames
//      in the 0.8 s after a hidden tab is shown; no main-thread task of
//      100 ms or longer during a drag turn or a fennec visit; and continued garden
//      animation over 3 s of reading after exploring ends. Its report, with the
//      browser and WebGL renderer it ran on, is in .qa/performance/report.json.
const env = { ...process.env, PERFORMANCE_BUDGETS: '1' };
const pattern = 'keeps animating|hidden tab|loads no scene|independent of sound';
const holds = spawnSync(process.execPath, [
  '--test', '--test-concurrency=1', '--test-timeout=240000',
  `--test-name-pattern=${pattern}`,
  fileURLToPath(new URL('./scene-lifecycle.test.mjs', import.meta.url)),
], { stdio: ['inherit', 'pipe', 'inherit'], env, encoding: 'utf8' });
if (holds.error) throw holds.error;
process.stdout.write(holds.stdout);
const ran = Number(holds.stdout.match(/^ℹ pass (\d+)/m)?.[1] ?? 0) + Number(holds.stdout.match(/^ℹ fail (\d+)/m)?.[1] ?? 0);
let holdsOk = holds.status === 0;
if (ran === 0) {
  console.error(`No test matched "${pattern}".`);
  holdsOk = false;
}

// The harness prints its JSON report on stdout and its pass/fail lines on stderr.
const exploration = spawnSync(process.execPath, [fileURLToPath(new URL('./performance.mjs', import.meta.url))], { stdio: ['inherit', 'pipe', 'inherit'], env, encoding: 'utf8' });
if (exploration.error) throw exploration.error;
let failed = [];
try { failed = JSON.parse(exploration.stdout).failed ?? []; } catch { failed = ['the performance report could not be read']; }
const explorationOk = exploration.status === 0;

console.log(`\nAnimation lifecycle (scene-lifecycle.test.mjs): ${holdsOk ? 'pass' : 'FAIL'}`);
console.log(`Exploration budgets (performance.mjs): ${explorationOk ? 'pass' : `FAIL${failed.length ? ` (${failed.join(', ')})` : ''}`}`);
process.exitCode = holdsOk && explorationOk ? 0 : 1;
