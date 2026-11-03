/** The optional rendering-cost detail view in the carbon tally's panel
 * (wired by src/narrative/ruler.ts, loaded only when it is first opened).
 * A sparkline of the CPU time each garden frame takes to submit (solid) and,
 * where the browser exposes GPU timers, the GPU time of the last frame
 * (dashed), with the visit's running rendering figure. It is this page's
 * estimated rendering cost, measured in the visitor's browser, never a
 * Wattch hardware measurement.
 *
 * It samples on a timer only while mounted and while the tab is visible:
 * hiding the tab clears the timer, and `destroy()` clears it for good, so
 * a closed view costs nothing. */
import { estimateCompute, type ComputeWork } from "../compute";

/** What the meter reads from the scene mount (`frameStats` of scene-mount.ts). */
export interface MeterStats {
  triangles: number;
  calls: number;
  /** Smoothed milliseconds to submit a frame. */
  ms: number;
  /** The last frame's GPU milliseconds, where timers exist. */
  gpuFrameMs: number | null;
}
export interface MeterScene {
  frameStats(): MeterStats | null;
  work(): ComputeWork | null;
}

export const METER_INTERVAL_MS = 300;
const SAMPLES = 48;

export function mountRenderMeter(container: HTMLElement, scene: MeterScene): { destroy(): void } {
  const doc = container.ownerDocument;
  container.innerHTML = `<canvas class="render-meter-spark" width="480" height="80" aria-hidden="true"></canvas>
    <p class="render-meter-readout" data-meter-readout></p>
    <p class="render-meter-readout" data-meter-total></p>
    <p class="render-meter-fine">This page’s estimated rendering cost, measured in your browser: CPU time per frame and, where the browser exposes GPU timers, GPU time, with assumed wattages and co2.js grid data. It is not a Wattch hardware measurement.</p>`;
  const canvas = container.querySelector<HTMLCanvasElement>("canvas")!;
  const readout = container.querySelector<HTMLElement>("[data-meter-readout]")!;
  const total = container.querySelector<HTMLElement>("[data-meter-total]")!;
  const cpu: number[] = [];
  const gpu: number[] = [];

  // Localization rewrites the text nodes, so compare with the English written.
  const written = new WeakMap<HTMLElement, string>();
  const write = (el: HTMLElement, text: string) => {
    if (written.get(el) === text) return;
    written.set(el, text);
    el.textContent = text;
  };

  function line(c: CanvasRenderingContext2D, values: number[], top: number) {
    const w = canvas.width, h = canvas.height;
    c.beginPath();
    values.forEach((v, i) => {
      const x = (i / (SAMPLES - 1)) * w, y = h - 6 - (v / top) * (h - 14);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    });
    c.stroke();
  }

  function sample() {
    const stats = scene.frameStats();
    if (!stats) {
      canvas.hidden = true;
      total.hidden = true;
      write(readout, "The live drawing is off, so there is nothing to measure.");
      return;
    }
    canvas.hidden = false;
    total.hidden = false;
    cpu.push(stats.ms);
    if (cpu.length > SAMPLES) cpu.shift();
    if (stats.gpuFrameMs !== null) {
      gpu.push(stats.gpuFrameMs);
      if (gpu.length > SAMPLES) gpu.shift();
    }
    const c = canvas.getContext("2d");
    if (c) {
      const css = getComputedStyle(doc.documentElement);
      const top = Math.max(2, ...cpu, ...gpu) * 1.15;
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.fillStyle = css.getPropertyValue("--hairline");
      c.fillRect(0, canvas.height - 2, canvas.width, 2);
      c.lineJoin = "round";
      if (gpu.length) {
        c.strokeStyle = css.getPropertyValue("--muted");
        c.lineWidth = 2;
        c.setLineDash([6, 5]);
        line(c, gpu, top);
        c.setLineDash([]);
      }
      c.strokeStyle = css.getPropertyValue("--stage");
      c.lineWidth = 3;
      line(c, cpu, top);
    }
    const triangles = stats.triangles.toLocaleString("en");
    write(readout, stats.gpuFrameMs === null
      ? `${stats.ms.toFixed(1)} ms of CPU per frame. ${triangles} triangles in ${stats.calls} draw calls.`
      : `${stats.ms.toFixed(1)} ms of CPU, ${stats.gpuFrameMs.toFixed(1)} ms of GPU per frame. ${triangles} triangles in ${stats.calls} draw calls.`);
    write(total, `Drawing the garden this visit: ${estimateCompute(scene.work()).figure}.`);
  }

  let timer = 0;
  const start = () => {
    if (timer || doc.hidden) return;
    sample();
    timer = window.setInterval(sample, METER_INTERVAL_MS);
  };
  const stop = () => { clearInterval(timer); timer = 0; };
  const onVisibility = () => { if (doc.hidden) stop(); else start(); };
  doc.addEventListener("visibilitychange", onVisibility);
  start();

  return {
    destroy() {
      stop();
      doc.removeEventListener("visibilitychange", onVisibility);
      container.textContent = "";
    },
  };
}
