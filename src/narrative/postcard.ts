/** Save a postcard (decision 44): the garden as the visitor has arranged it
 * (sky, trees, turn, weather, season), drawn from the one live stage into a
 * PNG with a caption and the portfolio's address, and downloaded. Made only
 * when asked (loaded by src/narrative/scene-mount.ts `GardenScene.postcard`);
 * nothing is sent anywhere. */
import { translate } from "../i18n";
import type { Garden } from "../scene";

export const POSTCARD_NAME = "living-notebook-garden.png";
const CAPTION = "A garden I tended in Chakib Belgaid’s living notebook";

/**
 * @param stage the live `.scene-stage` (sky behind, garden, sky in front)
 * @param cropLeft the share of the stage's width, from its left edge, kept
 *   out of the card: on wide layouts the garden is drawn right of the chapter
 *   card, so the card is centred on it.
 */
export async function savePostcard(stage: HTMLElement, garden: Garden, cropLeft = 0): Promise<boolean> {
  const box = stage.getBoundingClientRect();
  if (!box.width || !box.height) return false;
  const scale = Math.min(2, devicePixelRatio || 1);
  const skip = Math.max(0, Math.min(0.6, cropLeft)) * box.width;
  const width = Math.round((box.width - skip) * scale);
  const height = Math.round(box.height * scale);
  // Tall enough to read on a wide, short card too.
  const band = Math.round(Math.max(height * 0.13, width * 0.09));
  const card = document.createElement("canvas");
  card.width = width;
  card.height = height + band;
  const ctx = card.getContext("2d");
  if (!ctx) return false;
  const css = getComputedStyle(document.documentElement);
  const paper = css.getPropertyValue("--paper").trim() || "#0e2b48";
  const ink = css.getPropertyValue("--ink").trim() || "#e6f0f8";
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, card.width, card.height);
  // Each layer where it sits on the stage, shifted by the crop.
  const place = (el: Element) => {
    const r = el.getBoundingClientRect();
    return [(r.left - box.left - skip) * scale, (r.top - box.top) * scale, r.width * scale, r.height * scale] as const;
  };
  const back = stage.querySelector<HTMLCanvasElement>(":scope > .scene-sky:not(.scene-sky-front)");
  const front = stage.querySelector<HTMLCanvasElement>(":scope > .scene-sky-front");
  const scene = stage.querySelector<HTMLElement>(":scope > .scene-garden");
  if (back) ctx.drawImage(back, ...place(back));
  garden.drawInto(ctx, ...place(scene ?? stage));
  if (front) ctx.drawImage(front, ...place(front));
  // The caption, in the page's ink and type, on a band of paper.
  ctx.fillStyle = paper;
  ctx.fillRect(0, height, width, band);
  ctx.fillStyle = ink;
  ctx.direction = "ltr";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Newsreader, if the page has loaded it; set as large as fits the width.
  try { await document.fonts?.load(`italic ${Math.round(band * 0.3)}px Newsreader`); } catch { /* The fallback serif will do. */ }
  const caption = translate(CAPTION);
  let size = Math.round(band * 0.3);
  do ctx.font = `italic ${size}px Newsreader, Georgia, serif`;
  while (ctx.measureText(caption).width > width * 0.9 && --size > 8);
  ctx.fillText(caption, width / 2, height + band * 0.38);
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? `${location.origin}${location.pathname}`;
  ctx.font = `${Math.round(band * 0.2)}px Newsreader, Georgia, serif`;
  ctx.fillText(canonical.replace(/^https?:\/\//, "").replace(/\/$/, ""), width / 2, height + band * 0.72);
  const blob = await new Promise<Blob | null>(resolve => card.toBlob(resolve, "image/png"));
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = POSTCARD_NAME;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
