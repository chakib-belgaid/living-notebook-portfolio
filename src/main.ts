/** Composition root. The page is complete without this module: it only
 * enhances the static document rendered by src/render.ts. The reading
 * controller (src/narrative/controller.ts) tracks the active chapter and
 * performs every jump; src/navigation.ts turns link activations and history
 * events into its visits. The single scene (P4) subscribes to the controller
 * here. The retired controllers are kept for reference in src/legacy/ and are
 * not imported. */
import { initLocalization } from "./i18n";
import { initEvidence } from "./evidence";
import { initLocalizedLinks } from "./narrative/localized-links";
import { createController } from "./narrative/controller";
import { createNavigation } from "./navigation";

initLocalization();
initLocalizedLinks();
initEvidence();
const controller = createController();
createNavigation(controller);
document.documentElement.classList.add("enhanced");
