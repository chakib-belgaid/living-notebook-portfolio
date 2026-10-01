import { co2 } from "@tgwf/co2";

const swdm = new co2({ model: "swd", version: 4 });

export function formatGrams(grams: number) {
  if (grams >= 0.01) return `${grams.toFixed(grams < 1 ? 2 : 1)} g CO₂e`;
  const mg = grams * 1000;
  return mg < 0.01 ? "Under 0.01 mg CO₂e" : `${mg.toFixed(mg < 1 ? 2 : 1)} mg CO₂e`;
}

/** Resource Timing covers reported transfer, not the running energy of the scene. */
export function createTransferEstimate() {
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
      // SWDM v4 through co2.js: decimal GB, operational + embodied, global grid.
      const available = supported && !(!bytes && unknown);
      const grams = available ? swdm.perByte(bytes) : null;
      return {
        grams,
        figure: grams === null ? "Unavailable" : formatGrams(grams),
        source: supported ? `${(bytes / 1e6).toFixed(2)} MB reported · ${cached} cached resources · ${unknown} sizes unknown.` : "Transfer timing is unavailable in this browser.",
      };
    },
    dispose() { observer?.disconnect(); },
  };
}
