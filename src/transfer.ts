/** Resource Timing covers reported transfer, not the running energy of the scene. */
export function createTransferEstimate() {
  const gramsPerByte = 0.3 * 494 / 1e9; // SWDM v4, decimal GB, operational + embodied.
  let bytes = 0, cached = 0, unknown = 0;
  let supported = false;
  let observer: PerformanceObserver | undefined;
  try {
    observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        if (entry.transferSize > 0) bytes += entry.transferSize;
        else if (entry.transferSize === 0 && entry.decodedBodySize > 0) cached++;
        else unknown++;
      }
    });
    supported = PerformanceObserver.supportedEntryTypes.includes("resource");
    if (supported) {
      observer.observe({ type: "navigation", buffered: true });
      observer.observe({ type: "resource", buffered: true });
    }
  } catch { supported = false; }
  return {
    read() {
      const grams = bytes * gramsPerByte;
      return {
        figure: !supported || (!bytes && unknown) ? "Unavailable" : grams < 0.01 ? "Under 0.01 g CO₂e" : `${grams.toFixed(grams < 1 ? 2 : 1)} g CO₂e`,
        source: supported ? `${(bytes / 1e6).toFixed(2)} MB reported · ${cached} cached resources · ${unknown} sizes unknown.` : "Transfer timing is unavailable in this browser.",
      };
    },
    dispose() { observer?.disconnect(); },
  };
}
