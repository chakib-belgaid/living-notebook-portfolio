/** Locator screenshots crop pixels, including any overlapping page UI.
 * Hide that UI only during capture. Visibility preserves host geometry and
 * explicitly restoring the stage subtree also works inside portrait cards. */
export const sceneCaptureStyle = `
  body * { visibility: hidden !important; }
  .scene-stage, .scene-stage * { visibility: visible !important; }
`;

export function captureScene(stage, options = {}) {
  return stage.screenshot({ ...options, style: sceneCaptureStyle });
}
