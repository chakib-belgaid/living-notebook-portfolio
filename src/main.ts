/** Composition root. The page is complete without this module: it only
 * enhances the static document rendered by src/render.ts. Navigation (P3)
 * and the single scene (P4) attach here; the retired controllers are kept for
 * reference in src/legacy/ and are not imported. */
import { initLocalization } from "./i18n";
import { initEvidence } from "./evidence";
import { initLocalizedLinks } from "./narrative/localized-links";

initLocalization();
initLocalizedLinks();
initEvidence();
document.documentElement.classList.add("enhanced");
