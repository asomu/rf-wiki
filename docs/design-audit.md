# RF Wiki v1 design audit

Method: dual-agent (A: `/root/impeccable_assessment_a` · B: `/root/impeccable_assessment_b`)

- Date: 2026-07-11
- Target: home, search/glossary, and all six lesson/lab routes
- Viewports: 1440×1000, 1024×900, 720×900 (200% desktop approximation), 390×844
- Contract: `DESIGN.md` Precision Lab + local Impeccable detector + animation standards

## First impression

The site communicates a calm RF bench rather than a course landing page. The first three visual anchors are the question-led heading, the active learning position, and the instrument-like Signal Spine. The cold paper surface, graphite type, semantic signal colors, and dark plot surfaces feel specific to RF work. One-word verdict: **deliberate**.

The trunk test passes 6/6: RF Wiki identity, page title, primary sections, local options, breadcrumb/current module, and search are all visible without reconstructing the hierarchy.

## Design health after fixes

| # | Nielsen heuristic | Score | Evidence |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Current module/layer, prediction lock, retry, live feedback, and saved completion are visible. |
| 2 | Match with the real world | 4 | Source → DUT → Acquisition → DSP/Math → Display follows bench reasoning. |
| 3 | User control and freedom | 3 | Search, breadcrumbs, inline lab, layer anchors, and prediction retry provide exits. |
| 4 | Consistency and standards | 4 | One visual and interaction grammar spans all six modules. |
| 5 | Error prevention | 3 | Constrained controls, safe defaults, disabled premature actions, and measurement warnings prevent common mistakes. |
| 6 | Recognition rather than recall | 4 | Signal Spine, Linked Views, direct labels, glossary, and Cause/Effect Ledger keep context visible. |
| 7 | Flexibility and efficiency | 2 | Search and semantic anchors help experts; a dedicated compact bench-only mode remains optional future work. |
| 8 | Aesthetic and minimalist design | 4 | No decorative gradients, card mosaic, ornamental icon system, or redundant dark mode. |
| 9 | Error recognition and recovery | 3 | Wrong predictions identify the missed stage and `다시 선택` resets the state. |
| 10 | Help and documentation | 4 | Three learning depths, inline definitions, data tables, source links, and authoring documentation are searchable. |
| **Total** |  | **34/40** | **Good, near the excellent band.** |

- Design score: **A−**
- AI-slop score: **A** — low risk; the layout is purpose-built, not a generic SaaS template.
- Goodwill: **90/100** — the next action is clear, limitations are stated early, and errors teach the causal model.

## Findings and disposition

### Fixed

1. **P1 — Article and sticky lab competed as two lessons.** The permanent right rail is removed. Each simulator now appears inside the intuition layer at the exact concept checkpoint it explains, followed by the remaining intuition detail and then bench/theory.
2. **P2 — Prediction lock had weak recovery.** Checked choices now lock explicitly and expose `다시 선택`; resetting also clears lesson completion eligibility.
3. **P2 — Keyboard-triggered decorative motion.** Skip links and keyboard button activation are immediate. Pointer press feedback is limited to fine pointers; reduced motion removes transforms. Paint-property transitions and the lab hover lift were removed.
4. **P2 — Two 12 px one-off labels escaped the type scale.** Signal Spine detail and readout labels now use `--font-size-data`.
5. **P1 — Light-surface accent contrast.** Teal and oxide were adjusted to `#08746E` and `#925E00`, yielding 5.13:1 and 5.01:1 against the canvas while dark-instrument trace colors remain unchanged.
6. **P1 — Lab containment and hydration.** Lab columns use `minmax(0, 1fr)`, plots scale without horizontal scroll, all React islands hydrate without console errors, and SVG titles are React 19-safe.
7. **P1 — Three-column layout forced nested scrolling.** Desktop now uses compact wayfinding plus one main document. At 1180 px and below the map collapses; the Lab remains inline instead of becoming a second document before the article.
8. **P1 — Completion could be saved after prediction alone.** Completion now requires a correct prediction, a later real control change, and a 24-character explanation that names a causal link, the affected stage, the observed result, and the trade-off. Reset and later control changes clear the completion flag; explanation text is never persisted.
9. **P1 — RF pull surfaces contradicted the lesson.** Load/source-pull now separate Pout/gain, PAE, EVM and ACLR optima, distinguish fixed available source power from fixed accepted DUT power, and label the selected and metric-optimum Γ independently.
10. **P1 — RF convention drift.** OFDM uses the documented forward-unscaled/inverse-`1/N` convention end to end; Smith reference-plane direction, coupler useful-port excess loss, and analyzer attenuation diagnostics now match their equations and tests.
11. **P1 — Mobile performance missed the 90 gate.** Self-hosted font-face CSS is preloaded but applied as a non-render-blocking stylesheet. The system fallback renders immediately and IBM Plex remains the design font when available; all five Lighthouse routes now exceed the 90 performance gate.
12. **P1 — VNA progress and tab semantics were incomplete.** One-port `smith` and two-port `network` now have independent completion records, both are required for the VNA module, tab state persists after first visit, and Arrow keys/Home/End use roving focus without delayed focus theft.
13. **P2 — Several educational labels were ahead of the math.** Common phase now rotates the whole noisy IQ record; the RBW kernel is coherent-tone normalized; `0 dBFS = −30 dBm` is explicit; resource-grid power mode scales the actual IFFT bins; LTE PUCCH is separated from the PUSCH DFT-spreading chain; and PA DC slope is named incremental drain efficiency.
14. **P2 — Touch and visual evidence stopped at the lab controls.** Breadcrumb and reference links now expose 44 px touch height. IQ linked results, VNA two-port stability, and live search results have dedicated mobile snapshots, while an automated RGB audit rejects dimensions drift, missing files, extra files, and compositor-black pixels.
15. **P2 — Lighthouse depended on the unlocked macOS GUI session.** The audit now resolves Playwright's version-matched `chromium-headless-shell` instead of GUI Chrome for Testing, so paint traces remain available when the desktop session is locked.

### Accepted trade-offs

- Lessons remain deep because this is a reference Wiki, not a short tutorial. A short concept primer now reaches the causal Lab before the rest of the intuition detail, while the three anchors preserve the expert path.
- Signal Spine uses five columns when space permits and a vertical five-stage path on mobile. It has no horizontal carousel or hidden stages.
- The whole site does not implement dark mode; only instrument surfaces are dark, as required by the product contract.

### Figma verification and retained limitation

All eight named logical canvases are now populated and visually verified in `RF Wiki — Precision Lab`. The six reviewed 840×560 boards are placed in their matching frames, primitive teal/oxide values are synchronized to `#08746E` and `#925E00`, and the Foundations radius samples visibly show 0/6/10/14 px cards without clipping. The 24 browser baselines remain the pixel-level implementation evidence, while Core Screens is the distilled Figma review board. The only retained constraints are the Starter plan's three-physical-page limit, the exhausted MCP call quota, and raster placement of the six boards; editable board SVGs remain under `design/figma-boards/`.

## Automated and visual evidence

- Local Impeccable detector after fixes: `[]` (exit 0)
- Motion re-audit: pass, no remaining violations
- Playwright: 92/92 passing
  - 9 routes × 1440/1024/720/390 overflow checks
  - 9 route axe audits at every impact level
  - keyboard search, RBW→plot/ledger, SA↔IQ tabs, mobile focus order, desktop split layout, progress restore, and strict completion sequence
  - six lab hydration checks with zero console/page errors
  - 7 representative screens × 1440/1024/390 plus IQ, VNA two-port and search-result states = 24 screenshot regressions
  - visual-baseline RGB contract: expected dimensions and zero unexplained compositor-black pixels
- RF/component unit tests: 88/88 across 21 files
- Astro typecheck: 115 files, zero errors, warnings or hints
- Static build: 9 pages; Pagefind indexed 8 content pages and 5,485 words
- Lighthouse mobile production build:
  - Home: Performance 99, Accessibility 100, CLS 0.0022
  - Spectrum/IQ: Performance 99, Accessibility 100, CLS 0.0029
  - NR resource grid: Performance 99, Accessibility 100, CLS 0.0159
  - VNA/Smith: Performance 100, Accessibility 100, CLS 0.0029
  - PA load-pull: Performance 99, Accessibility 100, CLS 0.0032
- Dependency audit: `npm audit` reports zero known vulnerabilities
- Visual baselines: 24 PNGs under `tests/e2e/visual.spec.ts-snapshots/`, covering home, Spectrum/IQ, NR grid, VNA/Smith, coupler, load-pull, glossary, IQ results, two-port stability, and search results.

## Run notes

- Target slug: `src`
- Ignore list: none
- Assessment independence: preserved; design assessment and deterministic assessment ran in isolated agents
- CLI detector: executed before and after fixes
- Browser evidence: headless Chrome plus an authorized live Figma Chrome session; no injected review overlay
- Overlay injection: skipped because `SKILLS.md` forbids Impeccable live/source injection
- Temporary browser artifacts and auxiliary server: cleaned up
