/** Composition root. The page is complete without this module: it only
 * enhances the static document rendered by src/render.ts. The reading
 * controller (src/narrative/controller.ts) tracks the active chapter and
 * performs every jump; src/navigation.ts turns link activations and history
 * events into its visits; the scene mount (src/narrative/scene-mount.ts)
 * follows the controller with the one live scene, its posters and the
 * motion, stills and sound controls; the ruler (src/narrative/ruler.ts)
 * shows the reading position and the visit's carbon tally; the garden
 * panel (src/narrative/garden-panel.ts) lets the visitor set the sky, the
 * season and the quality, and plant trees. */
import { initHeader } from "./narrative/header";
import { initLocalization } from "./i18n";
import { initEvidence } from "./evidence";
import { initLocalizedLinks } from "./narrative/localized-links";
import { createController } from "./narrative/controller";
import { createNavigation } from "./navigation";
import { createSceneMount } from "./narrative/scene-mount";
import { createRuler } from "./narrative/ruler";
import { createGardenPanel } from "./narrative/garden-panel";

initLocalization();
initLocalizedLinks();
initEvidence();
document.documentElement.classList.add("enhanced");
initHeader();
const controller = createController();
createNavigation(controller);
const scene = createSceneMount(controller);
createRuler(controller, scene);
createGardenPanel(scene.garden);
