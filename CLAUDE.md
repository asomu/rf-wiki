# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RF Wiki ("Precision Lab") is a static Astro web app that teaches RF engineering by linking instrument settings, physical signals, calculation models, and on-screen results into one loop: prediction → manipulation → interpretation. Content is Korean-language; code, comments, and identifiers are English.

The site runs only built-in, deterministic RF/SCPI scenarios — no backend, login, telemetry, real file import, browser-to-instrument bridge, or live AI. Real instrument control lives separately under `examples/*_pyvisa/` as local, dry-run-first Python packages.

## Required reading before product/content/UI changes

Read in this priority order — later sources never override earlier ones:

1. `PRODUCT.md` — users, learning goals, v1 scope
2. `DESIGN.md` — Precision Lab visual system, interaction grammar, anti-slop rules
3. `SKILLS.md` — external design-skill supply chain and allowed use
4. `AGENTS.md` — full code boundaries, RF content rules, verification checklist

Do not change a design token, interaction grammar, physical color meaning, or anti-slop rule without explicit user approval. `AGENTS.md` is the authoritative, detailed rules file — this document summarizes the parts needed to navigate and run the codebase; when in doubt, defer to `AGENTS.md`.

## Commands

Requires Node >=22.12.0 (see `engines` in `package.json`).

```bash
npm install
npm run dev                 # Astro dev server

npm run check:design        # design-contract check (scripts/check-design.mjs)
npm run check:content       # content-contract check: lesson/instrument/DVT counts (scripts/check-content.mjs)
npm run check:visual-baselines
ASTRO_TELEMETRY_DISABLED=1 npm run typecheck   # astro check
npm run test:unit           # vitest run (tests/unit, tests/components)
npm run test:watch          # vitest watch mode
npm run test:python         # unittest discover across examples/*_pyvisa/tests
npm run test:hosting        # node --test tests/hosting/sites-worker.test.mjs
npm run build                # astro build + pagefind index
npm run test:e2e             # build, then Playwright against the static preview server
npm run audit:lighthouse     # build, then Lighthouse over ~19 representative routes

npm run test                 # check:design + check:content + check:visual-baselines + typecheck + test:unit + test:python + test:hosting + build
npm run test:all             # test + test:e2e + audit:lighthouse
```

Run a single vitest file: `npx vitest run tests/unit/<path>.test.ts`. Run a single Playwright spec: `npx playwright test tests/e2e/<path>.spec.ts`. `test:e2e` boots the app via `npm run preview` (production build, not dev server) so tests never depend on cold Vite compilation.

Public hosting is Cloudflare Pages via Git integration: `npm run build:cloudflare` (`scripts/build-cloudflare.mjs`) requires an https `PUBLIC_SITE_URL`, runs `npm run build`, and checks `dist/` for `404.html`, `_headers`, Pagefind, and no localhost URLs. Dashboard setup lives in `docs/deploy-cloudflare.md`.

Legacy: `npm run build:sites` (`scripts/build-sites.mjs`) packages the same static output plus a Cloudflare Worker (`dist/server/index.js`) for OpenAI Sites hosting, and validates the five instrument PyVISA ZIP packages (checksums, dry-run, fake-transport tests) in the process. `.openai/hosting.json`'s `project_id` is fixed at first project creation — never regenerate or swap it.

Scaffold a new lesson (writes into `src/content/lessons/`, refuses to overwrite, `--dry-run` writes nothing):

```bash
node scripts/new-lesson.mjs --title "..." --module <module-id> --slug <site-wide-unique-slug> --lab-id <id>
```

Scaffold a new instrument chapter:

```bash
npm run new:instrument-lesson -- --instrument e5080b --chapter <id> --title "..." --dry-run
```

See `docs/content-authoring.md` for the six-part lesson decomposition (dominant question, control, signal spine, linked views, cause/effect, completion evidence) and the module-ID table (`foundations`, `spectrum-iq`, `ofdm-lte-nr`, `vna-smith`, `power-coupling`, `pa-pull`).

## Architecture

- **Astro owns routing, layout, and prose.** React is only for simulator islands, prediction challenges, and state that genuinely needs client interactivity. Use visible/idle hydration for islands; static prose ships no unnecessary client JS.
- **Every simulator follows**: `Control → RF model → Linked Views → Cause/Effect Ledger → prediction/explanation`.
- **RF math is centralized and pure**: `src/lib/rf/` (complex numbers, FFT, S-parameters, Smith chart, couplers, load-pull, OFDM/resource grid, spectrum, units, etc.). UI components must never re-derive a formula that belongs here.
- **Instrument modeling**: `src/lib/instruments/` — per-instrument command catalogs and deterministic SCPI state machines (`sa.ts`, `mxg.ts`, `ena.ts`, `power-sensor.ts`, `psu.ts`, `scpi.ts`, `waveform.ts`, `programs.ts`). Educational SCPI parsing/state simulation is allowed here; real instrument access never is.
- **Cellular modeling**: `src/lib/cellular/` — GSM timing, PAMiD topology, diagnostic models, backed by `src/data/cellular-specs.ts` (every normative number must cite version/clause/table and say whether it's normative, conformance-oriented, or calculated).
- **Instrument baselines are pinned** in `src/data/instruments.ts`. Never mix commands across sibling instrument families (N5182B vs N5186A, N9020B vs other X-Series/apps, E5080B vs E5081A/PNA, U2061XA vs other U-Series sensors, N6705C vs other module families) without an explicit applicability note and official Keysight source.
- **Downloadable PyVISA packaging**: `src/lib/downloads/` generates the deployable per-instrument Python ZIPs + checksums consumed by `build:sites`.
- **Shared domain types**: `src/types/` — units are always carried in names or branded wrappers; never pass an unlabeled bare number across an RF API where Hz/dBm/Ω/degree ambiguity is possible.

### Content structure

- `src/content/lessons/*.mdx` — RF fundamentals/spectrum/OFDM/VNA/power/PA lessons, one MDX file per site-wide-unique slug, gated by `status: ready` (drafts are excluded from routes/search/nav)
- `src/content/instruments/<id>/` — per-instrument MDX chapters (e5080b, mxg/n5182b, n6705c, n9020b, u2061xa)
- `src/content/cellular-lessons.json` — registry of ~59 Cellular/PAMiD question-lessons
- `src/content/dvt/` — 6 LTE FDD PAMiD DVT synthesis lessons
- The content contract (lesson/chapter/question/DVT counts) is enforced by `npm run check:content`; keep counts and any related copy in `README.md`/`docs/MASTER_PLAN.md` in sync when adding content.

### Component structure

- `src/components/astro/` — static layout/learning components
- `src/components/lab/` — React simulator primitives
- `src/components/simulators/`, `src/components/cellular/`, `src/components/dvt/` — topic-specific simulator islands
- `src/components/plots/` — responsive SVG views
- PascalCase components, camelCase functions, explicit exported types. Reuse an existing shared component before writing a topic-specific clone. Cards are for independent state/interaction boundaries only — never nest them.

### Styling

- Every authored color/spacing/radius/type/z-index/motion/layout-width value must resolve to a token in `src/styles/tokens.css`. No hardcoded hex values (dynamic SVG may use semantic CSS variables only).
- IBM Plex Sans KR (prose/UI) and IBM Plex Mono (data/math/readout) are the only families. Site-wide dark mode is out of scope; dark tokens exist only for instrument/plot surfaces.

### RF/Cellular content rules (see `AGENTS.md` for full detail)

- Three-layer lessons: intuition → practical operation/interpretation → equation/standard.
- LTE/NR claims cite 3GPP Release 17; GSM claims cite Release 17 TS 45-series; equipment behavior cites official vendor docs where standards don't define it.
- Educational IQ views are never presented as compliance waveforms; no full channel coding/scrambling/reference-sequence generation/fading/certification judgement in the cellular visualizations.
- PAMiD examples stay generic — never publish or infer proprietary USID/register/bit-field values or present a virtual register as an MIPI/vendor-defined address.
- Keep GSM PA+ASM, LTE/NR FDD PAMiD, and NR TDD TxM paths distinct.
- State the convention for anything convention-dependent (FFT normalization, dB reference, S-parameter direction, coupler port naming, available/accepted/delivered power, gain definitions).
- Every plot: title, axes, units, current settings, marker, direct labels, text summary, data-table alternative. Never rely on color alone. Every simulator shows an educational-model disclaimer.

### Instrument example packages (`examples/*_pyvisa/`)

Each is a standalone dry-run-first Python package (driver, workflow, CLI, transport, tests). Transport execution and hazardous source/output enable are separate opt-in permissions; identity/module/option checks precede configuration; cleanup always starts with the safest OFF/abort command in `finally`. A software OFF is never a substitute for attenuation, fuse, remote inhibit, interlock, or DUT-specific bias sequencing. These packages are tested via `npm run test:python`, independent of the JS/TS test suite.

## Accessibility & verification

WCAG 2.2 AA, 44px targets, visible focus, full keyboard completion, and reduced-motion support are required everywhere. Before considering a change done, prefer running the full local gate: `npm run test` (design/content contracts, typecheck, unit, python, hosting, build), plus `npm run test:e2e` for keyboard/flow/axe/visual regression at 1440/1024/390px when touching UI. RF numeric tests must assert deterministic expected values with tolerance, not screenshots alone.
