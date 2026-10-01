/** A widget owns its listeners, speech and timers until its slot is replaced. */
export function widgetLifecycle() {
  let cleanup: (() => void) | undefined;
  return {
    replace(mount?: () => () => void) { cleanup?.(); cleanup = mount?.(); },
    dispose() { cleanup?.(); cleanup = undefined; },
  };
}
