import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Run the hardware-dependent limits explicitly, one browser file at a time,
// against a production preview (TEST_URL). No limit is relaxed to accommodate
// a software renderer. The names select the scene's reading holds, the hidden
// tab and the still preferences (tests/scene-lifecycle.test.mjs); a pattern
// that selects nothing fails the run instead of passing with zero tests.
const pattern = 'reading hold|hidden tab|loads no scene|independent of sound';
const result = spawnSync(process.execPath, [
  '--test', '--test-concurrency=1', '--test-timeout=240000',
  `--test-name-pattern=${pattern}`,
  fileURLToPath(new URL('./scene-lifecycle.test.mjs', import.meta.url)),
], { stdio: ['inherit', 'pipe', 'inherit'], env: { ...process.env, PERFORMANCE_BUDGETS: '1' }, encoding: 'utf8' });
if (result.error) throw result.error;
process.stdout.write(result.stdout);
const ran = Number(result.stdout.match(/^ℹ pass (\d+)/m)?.[1] ?? 0) + Number(result.stdout.match(/^ℹ fail (\d+)/m)?.[1] ?? 0);
if (ran === 0) {
  console.error(`No test matched "${pattern}".`);
  process.exitCode = 1;
} else process.exitCode = result.status ?? 1;
