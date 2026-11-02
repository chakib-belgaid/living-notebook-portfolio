/** The header's motion, stills and sound disclosure (markup in src/render.ts).
 * A button opens a small group of three toggles:
 * - Pause motion: the visitor's own pause (independent of sound). Under the
 *   system's reduced-motion setting it shows pressed and cannot be undone here.
 * - Still images: phase stills instead of the live drawing. Turning it off is
 *   how a reduced-motion, data-saving or `?view=stills` visitor asks for the
 *   live scene.
 * - Sound: the only way garden sound starts.
 * It owns no state: the scene mount passes it the state to show. */
export type ControlName = "pause" | "stills" | "sound";

export interface ControlsView {
  paused: boolean;
  /** The system's setting holds motion still; the pause cannot be lifted. */
  systemReduced: boolean;
  stills: boolean;
  /** No live drawing can be offered (failed renderer): stills stay on. */
  stillsLocked: boolean;
  sound: boolean;
  soundSupported: boolean;
  status: string;
}

export interface SceneControls {
  show(view: ControlsView): void;
  destroy(): void;
}

export function createSceneControls(onToggle: (name: ControlName) => void, root: Document = document): SceneControls | null {
  const wrapper = root.querySelector<HTMLElement>("[data-scene-controls]");
  if (!wrapper) return null;
  const toggle = wrapper.querySelector<HTMLButtonElement>(".scene-toggle")!;
  const panel = wrapper.querySelector<HTMLElement>(".scene-panel")!;
  // The live region sits outside the panel, so it is announced while the
  // panel is closed; the panel shows a copy that is hidden from assistive tech.
  const status = wrapper.querySelector<HTMLElement>("[data-scene-status]")!;
  const shown = wrapper.querySelector<HTMLElement>("[data-scene-status-shown]");
  const buttons = Object.fromEntries(
    [...wrapper.querySelectorAll<HTMLButtonElement>("[data-scene-control]")].map(b => [b.dataset.sceneControl, b]),
  ) as Record<ControlName, HTMLButtonElement>;

  let shownStatus = "";
  const open = (value: boolean) => {
    panel.hidden = !value;
    toggle.setAttribute("aria-expanded", String(value));
  };
  const onToggleClick = () => open(panel.hidden);
  const onPanelClick = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-scene-control]");
    if (!button || button.getAttribute("aria-disabled") === "true") return;
    onToggle(button.dataset.sceneControl as ControlName);
  };
  // Escape closes and returns focus; a click or focus elsewhere closes.
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || panel.hidden) return;
    open(false);
    toggle.focus();
  };
  const onOutside = (event: Event) => {
    if (!panel.hidden && !wrapper.contains(event.target as Node)) open(false);
  };
  toggle.addEventListener("click", onToggleClick);
  panel.addEventListener("click", onPanelClick);
  wrapper.addEventListener("keydown", onKey);
  root.addEventListener("pointerdown", onOutside, true);
  root.addEventListener("focusin", onOutside);
  wrapper.hidden = false;

  const press = (button: HTMLButtonElement, pressed: boolean, disabled: boolean) => {
    button.setAttribute("aria-pressed", String(pressed));
    if (disabled) button.setAttribute("aria-disabled", "true");
    else button.removeAttribute("aria-disabled");
  };

  return {
    show(view) {
      press(buttons.pause, view.paused || view.systemReduced, view.systemReduced);
      press(buttons.stills, view.stills, view.stillsLocked);
      press(buttons.sound, view.sound, false);
      buttons.sound.hidden = !view.soundSupported;
      // Compared with the English source: the page's localization rewrites
      // the rendered text in place.
      if (shownStatus !== view.status) {
        status.textContent = shownStatus = view.status;
        if (shown) shown.textContent = view.status;
      }
    },
    destroy() {
      toggle.removeEventListener("click", onToggleClick);
      panel.removeEventListener("click", onPanelClick);
      wrapper.removeEventListener("keydown", onKey);
      root.removeEventListener("pointerdown", onOutside, true);
      root.removeEventListener("focusin", onOutside);
      wrapper.hidden = true;
    },
  };
}
