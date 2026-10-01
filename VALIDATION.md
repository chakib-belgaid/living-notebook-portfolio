# Validation record

Validated locally in Chrome on 2026-09-08. These are browser checks on this machine, not physical-phone or cross-browser certification.

## Passed

- Mobile garden enlargement: full-width upper canvas and lower notebook pane at 390 × 844 and 375 × 667, tighter camera framing, project-detail access, and no document overflow. Desktop retains its side-by-side layout.

- Single-scene revision: document ends at full garden progress with no content below; main-view project descriptions and source links are visible without opening Work. Desktop/mobile navigation, optional project details, named markers, and no mobile horizontal overflow were checked. The page accessibility scan passed.

- Dark blueprint theme: desktop and 390 × 844 mobile visual checks, no horizontal overflow, theme persistence across reload, light/dark toggle, and dark page/dialog WCAG A/AA scans.

- TypeScript checking and Vite production build.
- Desktop 1440 × 960: inspected pencil, blueprint, and finished-garden views. The same geometry remains registered through the transition.
- Mobile 390 × 844 and 375 × 667: inspected layout, readable content, project dialogs, and the completed garden. No horizontal document overflow.
- Landscape 844 × 390: checked layout and no horizontal overflow; adjusted the work link to clear the stage controls.
- Visible animated waterfall, connecting water channel, and three original drones. The final scene reports approximately 29,000 triangles and 110 render calls before planting additional trees.
- Native project dialogs opened from garden markers and the selected-work section. Project details are now non-modal left-column panels, so the garden and navigation remain interactive. Escape closes details and restores focus.
- Plant interaction updates its live status and adds a small 3D tree.
- Pause/resume: verified that the animation clock remains unchanged while paused and advances after resuming.
- Reduced motion: verified a stopped animation clock and immediate still-scene stages at blueprint and bloom.
- Forced WebGL initialization failure: the fallback appeared; the work section and project dialog remained usable.
- axe-core WCAG 2 A / AA and WCAG 2.1 AA scan: no violations in the final tested page or project dialog.
- No runtime browser errors or warnings in the normal desktop preview session.

## Scope and limitations

- The garden is original real-time low-poly geometry inspired by the approved reference, not a photorealistic reconstruction of that image.
- Water and foliage motion use procedural shaders; no paid media services or external graphics assets are needed.
- The Three.js scene is a separate roughly 139 KB gzip JavaScript chunk. Vite reports its normal over-500-KB uncompressed chunk advisory. That is a bundle-size advisory, not a failed build.
- Chrome desktop and emulated mobile viewports were tested. Safari, Firefox, and physical mobile devices were not tested.
- WebGL2 is required for the garden. Portfolio content remains available if it cannot initialize.
- Public deployment was not requested or performed.
