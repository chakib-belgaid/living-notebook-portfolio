/** Yield between construction batches so navigation and input can run. */
export async function yieldTask() {
  const scheduler = (globalThis as typeof globalThis & { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) await scheduler.yield();
  else await new Promise<void>(resolve => setTimeout(resolve, 0));
}

export function phase(name: string) {
  const start = performance.now();
  performance.mark(`notebook:${name}:start`);
  return () => {
    performance.measure(`notebook:${name}`, { start, end: performance.now() });
    performance.mark(`notebook:${name}:end`);
  };
}
