import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Run the original hardware-dependent limits explicitly, with one browser file
// at a time. No limit is relaxed to accommodate a software renderer.
const result = spawnSync(process.execPath, [
  '--test', '--test-concurrency=1',
  '--test-name-pattern=a fennec visits|a paused, settled|a hidden tab',
  fileURLToPath(new URL('./interaction.test.mjs', import.meta.url)),
  fileURLToPath(new URL('./lifecycle.test.mjs', import.meta.url)),
], { stdio: 'inherit', env: { ...process.env, PERFORMANCE_BUDGETS: '1' } });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
