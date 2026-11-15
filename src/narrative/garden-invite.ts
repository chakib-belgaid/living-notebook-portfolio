/** The closing invitation (markup in src/render.ts `gardenInvite()`): at
 * Contact, once the story has been read, one button turns the garden's sound
 * on and starts exploring. It sits under the contact actions, so it never
 * competes with them, and appears nowhere earlier. Sound starts inside the
 * click itself, as browsers require. Where the browser has no audio, or
 * sound is already on, it only offers the walk; where the live drawing
 * failed, it stays hidden. Focus comes back to it when exploring ends. */
import type { GardenScene } from "./scene-mount";

const LABEL = {
  both: "Turn the sound on and walk around the garden",
  walk: "Walk around the garden",
} as const;

export function createGardenInvite(scene: GardenScene, root: Document = document) {
  const invite = root.querySelector<HTMLElement>("[data-garden-invite]");
  const button = invite?.querySelector<HTMLButtonElement>("button");
  const label = invite?.querySelector<HTMLElement>("[data-garden-invite-label]");
  if (!invite || !button || !label) return null;
  let shown = "";
  function sync() {
    invite!.hidden = root.documentElement.dataset.renderer === "failed";
    const text = scene.soundSupported() && !scene.sound() ? LABEL.both : LABEL.walk;
    if (text !== shown) label!.textContent = shown = text;
    button!.disabled = scene.exploring();
  }
  const onClick = () => {
    if (scene.soundSupported()) scene.startSound();
    void scene.explore(button).finally(sync);
  };
  button.addEventListener("click", onClick);
  const offState = scene.onState(sync);
  const offExplore = scene.onExplore(sync);
  sync();
  return {
    destroy() {
      button.removeEventListener("click", onClick);
      offState();
      offExplore();
      invite.hidden = true;
    },
  };
}
