# Progress record

Shared state between implementation sessions. Each session reads this first and updates it last. One section per phase; P2–P4 record slice and breadth separately. Record release, session/date, files touched, checks and capture paths when updating a phase. Status words: `not started`, `in progress`, `blocked`, `reviewed`, `done`. Never write `done` for code that has not been visually exercised. Handoff corrections below are findings and planned work, not completed application changes.

Release 1 cap: twenty working days from the first implementation session. Days used so far: 0.

## Decision gates

| Gate | When | Reviewer | Status | Entry |
| --- | --- | --- | --- | --- |
| G1 Motion study | End of P1 | User | not started | — |
| G2 Release-1 slice review | After P2–P4 for intro → work → Whisperbook → existing Android `/work/whispbook/` → back → contact, with CV placement and repaired case assets | User | not started | — |

P5/new case routes and P6/exploration are not G2 prerequisites. Complete the release-1 candidate before starting them. An unresolved CV fact is a P2 publication blocker, not a blocker for independent layout work or G2's visual review; close CV verification before the release-1 candidate passes P7/P8. Translation review is asynchronous and bundled below; it does not add a design gate. Publication follows the authorization in the implementation chat.

## Open questions for the user

- Confirm Arabic stays a visible site language (default: yes).
- Confirm the build behind `public/assets/whisperbook.webp`, or capture a fresh one on the Nothing Phone 3 (needed for release 2 only).

That capture question is required only if the image is reused as proof; text-first cases can ship without it.

## Release-1 issues to resolve

| Finding | Owner phase | Required resolution | Status / evidence |
| --- | --- | --- | --- |
| Legacy `/work/whispbook/` and French copy are Android, not the web studio | P2/P3 | Preserve Android route identity; web studio links to its separate repository; test Android return to `#whisperbook` | not started |
| Both short-CV HTML sources retain the 300× PowerAPI claim excluded without clarified attribution; PDFs have not been audited by this handoff review | P0 audit → P2 correction/verification | Apply content contract, align HTML/PDFs, inspect all PDF pages and verify downloads before release 1 | not started |
| Six retained-case images absent locally | P0 inventory → P3 repair | Resolve each through verified recovery or text-first markup repair in EN/FR; verify clean output in P7/P8 | not started; see asset table below |
| Product and old tests retain planting, postcard and fennec visits | P4 removal → P7 validation | Remove discarded behavior/controls and obsolete expectations; update named test selections and preserve independent coverage for retained behavior | not started |

### CV verification record

| Locale | Source HTML | Published PDF | Source corrections / PDF SHA-256 / visual review |
| --- | --- | --- | --- |
| EN | `public/resume/chakib-belgaid-product-engineer-en.html` | `public/resume/chakib-belgaid-product-engineer-en.pdf` | not started |
| FR | `public/resume/chakib-belgaid-product-engineer-fr.html` | `public/resume/chakib-belgaid-product-engineer-fr.pdf` | not started |

### Retained-case asset resolutions

Paths below are under `public/assets/projects/`. Follow the [asset protocol](CONTENT_AND_EVIDENCE.md#retained-case-assets-missing-from-this-checkout). For recovered files, record provenance/checksum; for a text-first resolution, record repaired EN/FR markup and preview checks. “Missing” records checkout state, not live-site availability.

| Path | Resolution | Validation / evidence |
| --- | --- | --- |
| `whisperbook/now-playing.webp` | Missing; not started | — |
| `whisperbook/read-along.webp` | Missing; not started | — |
| `whisperbook/voice-cast.webp` | Missing; not started | — |
| `whisperbook/library.webp` | Missing; not started | — |
| `wattch/deterministic-trace.png` | Missing; not started | — |
| `wattch/energy-tests.png` | Missing; not started | — |

## Descopes taken

None.

## Strings awaiting the user's review

List every new string, including breadth and release-2 additions after G2. French must be reviewed before publication; only Arabic review may be deferred under the recorded descoping order, with a visible draft label. Record any English-only new-case decision separately.

| Release / key | English | French draft / review status | Arabic draft / review status | Review or descope reference |
| --- | --- | --- | --- | --- |

## Acceptance evidence by release

Use the [release applicability table](ACCEPTANCE.md#release-applicability). Link a report with per-check status and evidence; do not mark deferred work as passed.

| Release | Required scope | Check results / evidence | Deferred work |
| --- | --- | --- | --- |
| 1 | Eight chapters, CVs, retained cases/assets/returns, removed-feature cleanup and applicable accessibility/localization/performance checks | not started | F8b, F23–F24 exploration checks, F25b; new cases and exploration belong to release 2 |
| 2 | New main cases and exploration plus regression checks on release-1 behavior | not started | None by default |

## Phases

### P0 — Baseline and working context

- Status: not started
- Session: —
- Source SHA at start: —
- Files touched: —
- Validation run: —
- Captures: —
- CV discrepancy audit: not started
- Retained-case dependency inventory: not started
- Open issues: —

### P1 — Actual-house motion study

- Status: not started
- Outcome (a / b / c): —
- Portrait slot approach tried (45 percent, sticky during transition): —
- Recordings: —
- Open issues: —

### P2 — Content model, static semantic shell and verified CVs (release 1)

- Slice status: not started
- Breadth status: not started
- CV source/PDF verification: not started; see CV record above
- Open issues: —

### P3 — Layout, retained-case repairs and state restoration (release 1)

- Slice status: not started
- Breadth status: not started
- Legacy Android EN/FR return-path checks: not started
- Missing-asset resolutions: not started; see asset table above
- Open issues: —

### P4 — Guided scene integration and lifecycle (release 1)

- Slice status: not started
- Breadth status: not started
- Open issues: —

### P7 — Regression, localization, accessibility, performance (release 1)

- Status: not started
- Devices covered: —
- Applicable acceptance report: —
- French review / Arabic review or recorded descope: —
- Clean-build case dependency checks: —
- Open issues: —

### P8 — Release 1 candidate and publication

- Status: not started
- Release-1 candidate complete: no
- PR: —
- Deployed SHA: —
- Rollback reference: —

### P5 — Main case pages and evidence assets (release 2)

- Status: not started
- Prerequisite: release-1 P7/P8 candidate complete (publication not required)
- Representative new `/work/whisperbook/` case and return path: not started
- Remaining main cases / retained-route compatibility: not started
- Existing verified CV links: not started

### P6 — Finished-house exploration (release 2)

- Status: not started
- Prerequisite: release-1 P7/P8 candidate complete and P4 adapter available

### P7 / P8 — Release 2 closure and publication

- Status: not started
- Applicable acceptance report / release-1 regressions: —
- French review / Arabic review or recorded descope: —
- PR / deployed SHA / rollback reference: —
