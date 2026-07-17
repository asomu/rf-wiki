---
phase: bit-iq-rf
reviewed: 2026-07-17T04:05:01Z
depth: deep
status: issues_found
remediation_status: resolved
files_reviewed: 36
files_reviewed_list:
  - DESIGN.md
  - PRODUCT.md
  - README.md
  - scripts/check-content.mjs
  - scripts/check-visual-baselines.mjs
  - src/components/astro/CellularLearningMap.astro
  - src/components/astro/CellularLessonBody.astro
  - src/components/astro/CellularVisual.astro
  - src/components/astro/CodingTransformDiagram.astro
  - src/components/astro/ConstellationGuideDiagram.astro
  - src/components/astro/DpdFlowDiagram.astro
  - src/components/astro/EnvelopePaprDiagram.astro
  - src/components/astro/SignalJourneyDiagram.astro
  - src/components/lab/lab.css
  - src/components/plots/PaConstellationPlot.tsx
  - src/components/plots/ReceiverDecisionPlot.tsx
  - src/components/simulators/LoadPullLab.tsx
  - src/components/simulators/ReceiverRecoveryLab.tsx
  - src/content.config.ts
  - src/content/cellular-lessons.json
  - src/data/cellular-specs.ts
  - src/data/cellular.ts
  - src/lib/cellular/index.ts
  - src/lib/cellular/recovery.ts
  - src/lib/rf/pa.ts
  - src/pages/cellular/index.astro
  - src/pages/index.astro
  - src/styles/cellular.css
  - tests/components/ReceiverRecoveryLab.test.tsx
  - tests/e2e/interactions.spec.ts
  - tests/e2e/routes.spec.ts
  - tests/e2e/routes.ts
  - tests/e2e/visual.spec.ts
  - tests/unit/cellular-recovery.test.ts
  - tests/unit/cellular.test.ts
  - tests/unit/pa-envelope.test.ts
findings:
  critical: 1
  warning: 6
  info: 0
  total: 7
---

# Bit → IQ → RF → IQ → Bit: Code Review Report

**Reviewed:** 2026-07-17T04:05:01Z  
**Depth:** deep  
**Files reviewed:** 36 source, content, style, and test files; generated PNG baselines were inspected as artifacts but excluded from the source-file count  
**Status:** issues found

## Summary

The expansion builds, type-checks, indexes, and passes its current unit suite, but it is not ready to ship. The coding lesson teaches a length relationship that is false once code-block segmentation occurs. Six additional confirmed issues affect standards traceability, modulation convention accuracy, public RF API robustness, mobile plot legibility, plot completeness, and regression-test reliability.

Validation completed during review:

- `npm run check:design` — passed
- `npm run check:content` — passed (59 ready lessons across six sections)
- `npm run check:visual-baselines` — passed (81 expected PNGs)
- `npm run typecheck` — passed (210 files, zero diagnostics)
- `npm run test:unit` — passed (42 files, 290 tests)
- `npm run build` — passed (111 pages; Pagefind indexed 110 pages)

These passes do not exercise the failure cases below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01 [BLOCKER]: The coding chain incorrectly equates a per-code-block rate-matched length with the concatenated codeword length

**Files:** `src/content/cellular-lessons.json:60-62`; `src/components/astro/CodingTransformDiagram.astro:13-15`  
**Issue:** The lesson explicitly discusses code-block segmentation and code-block count, but then renders `rate-matched E → scrambled G, generally G = E`. In LTE/NR notation, rate matching produces `E_r` bits for each code block; code-block concatenation produces `G = Σ_r E_r` bits. `G = E_r` is only true for a single code block (or if `E` is deliberately redefined as a non-standard total, which the page does not say). The diagram also omits the concatenation stage, so the error is repeated visually.  
**Impact / repro:** Use any transport block that segments into `C > 1` code blocks. With two rate-matched blocks of lengths `E_0` and `E_1`, the transmitted codeword has `G = E_0 + E_1`, not `G = E_0` or `G = E_1`. A learner following the current formula will compute or label the physical-channel bit count incorrectly.  
**Fix:** Change the model and diagram to `rate matching: E_r per code block → code-block concatenation: G = Σ E_r → scrambling: G input bits → G output bits`. If the page intends a simplified aggregate, rename it `E_total` and state explicitly that this is local, non-standard notation; retaining the standard `E`/`G` symbols while changing their meaning is unsafe.  
**Verification:** Add a content/unit assertion for a segmented `C = 2` example that verifies `G = E_0 + E_1`, verifies the concatenation step is present, and rejects the literal `G = E` unless the page declares `E_total`.

## Warnings

### WR-01 [WARNING]: The scrambling claims are not traced to the clauses that define scrambling

**Files:** `src/content/cellular-lessons.json:59-65`; `src/data/cellular-specs.ts:36-38`; `src/data/cellular-specs.ts:64-74`; `tests/unit/cellular.test.ts:105-113`; `scripts/check-content.mjs:307-313`  
**Issue:** The new lesson makes normative LTE/NR scrambling claims but cites only TS 36.212/38.212 channel-coding clauses. PUSCH scrambling is defined in TS 36.211 clause 5.3.1 and TS 38.211 clause 6.3.1.1. The current contract check only proves that each reference ID exists, and the unit test locks in the incomplete four-reference set; neither checks that a cited clause supports the claim.  
**Impact / repro:** Open the lesson's clause trace and follow all four sources. They cover CRC, coding, rate matching, UL-SCH, and control coding, but do not provide the scrambling rule described on the page. This violates the project's exact Release-17 clause-trace requirement and leaves a normative statement unreviewable from the UI.  
**Fix:** Add exact Release-17 registry entries for LTE 36.211 §5.3.1 and NR 38.211 §6.3.1.1, attach them to the lesson, and change the unit test to require those IDs in addition to the coding clauses. Consider adding a semantic content rule for lessons whose concepts include `scrambling`.  
**Verification:** The rendered reference table must contain both physical-channel scrambling clauses, and a test must fail if either reference is removed or replaced by a coding-only clause.

### WR-02 [WARNING]: The NR π/2-BPSK diagram applies an unstated global phase rotation and its table does not expose the plotted sequence

**Files:** `src/components/astro/ConstellationGuideDiagram.astro:14-20`; `src/components/astro/ConstellationGuideDiagram.astro:38-49`; `src/components/astro/ConstellationGuideDiagram.astro:98-115`; `src/content/cellular-lessons.json:1023-1028`  
**Issue:** For bits `0, 0, 1, 1`, TS 38.211 §5.1.1 maps the normalized sequence to the diagonal coordinates `(+1,+1)/√2`, `(-1,+1)/√2`, `(-1,-1)/√2`, `(+1,-1)/√2`. The component instead plots the cardinal coordinates `(+1,0)`, `(0,+1)`, `(-1,0)`, `(0,-1)`. That is a global `-45°` display rotation, but neither settings, description, nor lesson declares the convention. The data alternative lists only modulation order and minimum distance, not the four plotted bit/index/I/Q values, so a non-visual reader cannot recover or audit the sequence.  
**Impact / repro:** Compare the four hard-coded points to the cited Release-17 modulation equation. The phase progression is preserved, but the absolute normalized I/Q mapping is shifted by 45° while the UI presents it as the standard mapping. This is especially confusing because the lesson tells readers to consult TS 38.211 and the project requires convention-dependent quantities to state their convention.  
**Fix:** Prefer the clause-native diagonal coordinates. If the cardinal display is intentional, label it explicitly as a global `e^{-jπ/4}` visualization rotation in the settings, description, and table. Expand the table to include `n`, input bit, normalized I, normalized Q, and phase for every displayed point.  
**Verification:** Add a deterministic unit/content test for all four coordinates (or for the declared rotation), and an accessibility test that verifies each plotted sequence point appears in the data table. Reference: [ETSI TS 138 211 V17.7.0, clause 5.1.1](https://www.etsi.org/deliver/etsi_ts/138200_138299/138211/17.07.00_60/ts_138211v170700p.pdf).

### WR-03 [WARNING]: The new public PA transform accepts a non-finite AM-PM model and returns non-finite RF results

**Files:** `src/lib/rf/pa.ts:45-64`; `src/lib/rf/pa.ts:71-112`; `tests/unit/pa-envelope.test.ts:4-29`  
**Issue:** `transformNormalizedPaSample` validates finite I/Q, smoothness, exponent, and ACLR, but `validatePaModel` never checks `phaseAtSaturationDegrees`. A model with `phaseAtSaturationDegrees: NaN` or `Infinity` passes validation and propagates non-finite values through the returned phase and complex output. The new tests cover normal and zero inputs only.  
**Impact / repro:** Call `transformNormalizedPaSample({ re: 1, im: 0 }, { ...DEFAULT_EDUCATIONAL_PA, phaseAtSaturationDegrees: NaN })`. The function returns `phaseShiftDegrees = NaN` and a complex sample containing `NaN` instead of rejecting an invalid public RF-model input. A plot consuming the result receives invalid SVG coordinates.  
**Fix:** Validate `Number.isFinite(model.phaseAtSaturationDegrees)` before calculating the transform. Audit the same validator's remaining public numeric fields (`smallSignalGainDb`, `saturationOutputPowerDbm`, `drainVoltageV`, `quiescentCurrentA`, and `incrementalDrainEfficiency`) so all public PA entry points reject `NaN`/`Infinity` consistently.  
**Verification:** Add table-driven tests that pass `NaN`, `Infinity`, and `-Infinity` for each public model field and expect a `RangeError`; also assert every field of a valid returned sample is finite.

### WR-04 [WARNING]: The two new fixed-viewBox lab plots render labels below the project's mobile legibility floor

**Files:** `DESIGN.md:197`; `src/components/plots/ReceiverDecisionPlot.tsx:44-49`; `src/components/plots/ReceiverDecisionPlot.tsx:68-72`; `src/components/plots/PaConstellationPlot.tsx:35-60`; `src/components/lab/lab.css:371-374`; `src/components/lab/lab.css:398-402`; `src/components/lab/lab.css:605-623`  
**Issue:** Both plots use a 560-unit-wide fixed viewBox, while their axis/point labels use the 13px `--font-size-data` value as SVG user units. At a 390px viewport the best-case scale is `390/560`, making those labels at most about 9.1 CSS px; the actual plot width is smaller after page and frame padding. There is no narrow-container compensation for these plots, even though `DESIGN.md` explicitly requires fixed-viewBox labels to remain about 10px or larger. Existing static cellular plots already apply such compensation in `src/styles/cellular.css:1793-1795`.  
**Impact / repro:** Render either receiver recovery or the appended PA constellation at 390px. Axis values and direct labels shrink below the agreed legibility floor, and browser zoom increases reflow pressure without correcting the SVG's internal scale.  
**Fix:** Add token-based narrow-container font compensation for `.receiver-decision-plot` and `.pa-constellation` text (for example, the established headline-token approach), or move labels to non-scaling HTML overlays. Check collisions after increasing the user-unit font size.  
**Verification:** At 390px and 200% zoom, use Playwright bounding boxes or screenshot review to prove every visible SVG label is at least 10 CSS px high, remains unclipped, and does not overlap its marker/ticks.

### WR-05 [WARNING]: The receiver decision plot is not quantitatively readable and does not report its current channel settings

**Files:** `src/components/plots/ReceiverDecisionPlot.tsx:56-72`; `src/components/simulators/ReceiverRecoveryLab.tsx:167-185`  
**Issue:** The decision plane draws grid lines at `-1`, `-0.5`, `0.5`, and `1` but renders no numeric tick labels. Its table's `Setting` row reports only unit-power QPSK, observation time, and known-H equalization; it omits the current H magnitude, H phase, residual CFO, and noise-vector magnitude that determine the measured and equalized points. This violates the project contract that every plot show axes, units, and current settings, and it prevents a table-only reader from reproducing the plotted state.  
**Impact / repro:** Change channel magnitude/phase, residual frequency offset, or deterministic noise. The point coordinates update, but the plot/table offers no complete record of which settings produced them, and the unlabeled grid cannot be read numerically without reverse-engineering the viewBox scale.  
**Fix:** Add numeric I/Q ticks. Include all four current model controls (with units and noise direction/convention) in the plot settings/table, or pass them into the plot description as explicit props while retaining them in the semantic table.  
**Verification:** Add an interaction test that changes each slider and asserts the decision-plane table/settings update to the exact values; assert the expected numeric tick texts are present at 1440, 1024, and 390px.

### WR-06 [WARNING]: Visual regression does not cover four new static visual routes or the newly appended PA plots

**Files:** `tests/e2e/routes.spec.ts:22-49`; `tests/e2e/visual.spec.ts:48-52`; `tests/e2e/visual.spec.ts:64-81`; `tests/e2e/visual.spec.ts:181-196`; `tests/e2e/visual.spec.ts:240-257`; `scripts/check-visual-baselines.mjs:10-37`; `src/components/simulators/LoadPullLab.tsx:204-210`  
**Issue:** Pixel baselines were added only for signal journey, coding chain, and receiver recovery. The new envelope/PAPR, DPD flow, LTE constellation, and NR π/2-BPSK routes receive only a 390px visibility/table-count smoke test. The existing `pa-load-pull` visual scenario has no `captureSelector`; `waitForScenario` resets scroll to zero before a viewport-only screenshot, while the newly added AM-PM and 16QAM plots are appended deep in the lab. Consequently those plots are not present in the baseline image. The baseline checker can still pass because it only expects the old scenario names.  
**Impact / repro:** Break the layout or labels in any omitted static diagram, or in `LoadPullLab` lines 204-210. The current responsive visual suite and baseline inventory remain green as long as the route still contains one table and does not overflow the document. This is a reliability defect in the tests specifically added to protect the expansion.  
**Fix:** Add responsive visual scenarios and 1440/1024/390 baselines for the four omitted routes. Add a separately named, targeted LoadPull capture selector around the AM-PM/PA-constellation section (a stable `data-*` hook is preferable), and register every scenario in the baseline checker.  
**Verification:** Confirm the expected baseline inventory grows by three files per new scenario. Deliberately alter one plotted label/position in each target and verify its corresponding screenshot test fails before reverting the probe.

## Optional Improvements

None. All findings above are confirmed correctness, robustness, accessibility-contract, or test-reliability defects; speculative and style-only observations were omitted.

## Remediation verification

All seven findings were resolved after this review and independently re-verified by the root agent.

- **CR-01:** Added code-block concatenation and corrected the relationship to `G = Σ E_r`; scrambling now preserves `G` input/output length.
- **WR-01:** Added LTE TS 36.211 §5.3.1 and NR TS 38.211 §6.3.1.1 references plus semantic content guards.
- **WR-02:** Replaced the unstated rotated π/2-BPSK view with clause-native normalized coordinates and a complete sequence table.
- **WR-03:** Added finite-number validation for every public PA model field and table-driven non-finite tests.
- **WR-04–05:** Added token-based mobile label compensation, numeric ticks, complete receiver settings, and 390px/200% legibility assertions.
- **WR-06:** Added responsive baselines for the four omitted static routes, the receiver plot group, and the appended PA linearity plots.

Final verification: content/design/baseline contracts passed; Astro reported zero diagnostics; 303 Vitest tests, 114 Python safety tests, 3 hosting tests, and 599 Playwright tests passed; 111 pages built and Pagefind indexed 110 pages. Visual baseline inventory: 96 PNGs.

---

_Reviewed: 2026-07-17T04:05:01Z_  
_Reviewer: gsd-code-reviewer_  
_Depth: deep_
