/* How the camera fits the garden in its frame, kept out of scene.ts so stills
   can be captured with the same fit. */

/** The world units the garden's frame spans, top to bottom, for a frame of
    `aspect` (its width over its height) in a host `width` CSS pixels wide.
    The fit follows the host the garden is drawn in, not the window: a
    portrait chapter slot on a phone (narrow, about as tall as it is wide)
    draws the garden larger than the tall rail of a wide layout does. */
export function gardenSpan(aspect: number, width: number) {
  const slot = width <= 760 && aspect >= 0.75;
  return slot
    ? Math.max(12.8, 14.6 / aspect)
    : aspect < 0.9
      ? 16.4 / aspect
      : 15.6;
}
