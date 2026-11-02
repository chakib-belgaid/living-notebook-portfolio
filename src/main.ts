/** Composition root. The page is complete without this module: it only
 * enhances the static document rendered by src/render.ts. The reading
 * controller (src/narrative/controller.ts) tracks the active chapter and
 * performs every jump; src/navigation.ts turns link activations and history
 * events into its visits; the scene mount (src/narrative/scene-mount.ts)
 * follows the controller with the one live scene, its posters and the
 * motion, stills and sound controls. */
import { initLocalization } from "./i18n";
import { initEvidence } from "./evidence";
import { initLocalizedLinks } from "./narrative/localized-links";
import { createController } from "./narrative/controller";
import { createNavigation } from "./navigation";
import { createSceneMount } from "./narrative/scene-mount";

initLocalization();
initLocalizedLinks();
initEvidence();
const controller = createController();
createNavigation(controller);
createSceneMount(controller);
document.documentElement.classList.add("enhanced");
