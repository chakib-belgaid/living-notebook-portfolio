import { averageIntensity } from "@tgwf/co2";
import { formatGrams } from "./transfer.ts";

/* Assumed draw while the device is busy drawing the garden: one laptop CPU
   core under load, and a laptop-class GPU. Browsers expose time, not power. */
export const CPU_WATTS = 10;
export const GPU_WATTS = 20;
/** Ember's world average grid intensity, from co2.js, in g CO₂e/kWh. */
export const GRID_INTENSITY = averageIntensity.data.WORLD;

export interface ComputeWork {
  /** Main-thread milliseconds spent updating and submitting frames. */
  cpuMs: number;
  /** GPU milliseconds, or null when the browser does not expose GPU timers. */
  gpuMs: number | null;
  frames: number;
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;

/** Measured rendering and animation time × assumed power × grid intensity. */
export function estimateCompute(work: ComputeWork | null) {
  if (!work) return { grams: null, figure: "Unavailable", source: "Rendering is off in this browser." };
  const joules = (work.cpuMs * CPU_WATTS + (work.gpuMs ?? 0) * GPU_WATTS) / 1000;
  const grams = (joules / 3.6e6) * GRID_INTENSITY;
  const gpu = work.gpuMs === null ? "GPU time not exposed by this browser" : `${seconds(work.gpuMs)} GPU`;
  return {
    grams,
    figure: formatGrams(grams),
    source: `${seconds(work.cpuMs)} CPU · ${gpu} · ${work.frames.toLocaleString("en")} frames drawn.`,
  };
}
