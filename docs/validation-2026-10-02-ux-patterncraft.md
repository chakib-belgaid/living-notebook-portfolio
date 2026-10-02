# UX Patterncraft follow-up — 2026-10-02

Implemented the desktop/mobile findings from the UX Patterncraft review:

- Mobile project cards describe the product before disclosure and use View project / View background labels.
- The garden switch keeps a visible text label; the opening mobile card explains scrolling.
- Desktop garden navigation names the six content destinations and marks the current one.
- Project details include existing functional outcomes, illustration limitations, and an explicit statement that release availability is not documented here. No release or usage metrics were inferred.
- Contact offers Open email draft, Copy address, and Copy note. The address remains selectable inside the mobile sheet. Clipboard rejection selects the relevant content for manual copying. Successful copies and email handoff requests are announced in a status region. Opening a mailto link no longer triggers the garden's sent animation.
- New strings are translated into French and Arabic.

## Verification

- `npm run build`: passed TypeScript and production build. Existing large scene-chunk warning remains.
- `TEST_URL=http://127.0.0.1:5200 PLAYWRIGHT_CHANNEL=chrome npm test`: 46/46 passed, including desktop/mobile clipboard success, rejection, intercepted email handoff, and draft retention after sheet dismissal.
- Added project fields passed the translation-coverage test against the production preview.
- Production browser checks at 1440×900, 390×844, and 320×568: no horizontal page overflow or page errors; project disclosures, manual copy selection, clipboard success, and encoded draft handoff passed.
- French and Arabic 390×844 screenshots inspected; existing regression coverage includes enlarged text, landscape, reduced motion, history, offline weather, and unavailable WebGL.
- Screenshots: `/Users/chakib/Documents/Codex/2026-10-02/portfolio-ux-review/`.
- Preview: `http://127.0.0.1:5201/`.

An earlier dev preview served stale transformed modules. Its test output was discarded; the regression result above uses a freshly started server, and final screenshots use the production build.

Physical-device virtual keyboards, VoiceOver, and a full contrast audit remain unverified. Changes are local and uncommitted; no email was sent and no deployment was performed.
