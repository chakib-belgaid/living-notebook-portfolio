/* How the camera fits the garden in its frame, kept out of scene.ts so the
   still shown while the scene loads can sit exactly where the drawing starts. */

/** The world units the garden's frame spans, top to bottom, for a frame of
    `aspect` (its width over its height). */
export function gardenSpan(aspect: number) {
  const stackedMobile = innerWidth <= 760 && innerHeight > 520;
  return stackedMobile
    ? Math.max(12.8, 16.4 / aspect)
    : aspect < 0.9
      ? 16.4 / aspect
      : 15.6;
}

/** The loading still: captured at this size, with the garden's frame the
    whole view and the camera's look point at its centre (scripts/capture-stills.mjs). */
export const loadingStill = { width: 1440, height: 900 };
