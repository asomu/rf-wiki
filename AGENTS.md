# RF Wiki Agent Rules

## Required context

Before any product, content, Figma or UI change, read `PRODUCT.md`, `DESIGN.md`, and `SKILLS.md`. Their priority is:

1. `DESIGN.md`
2. the approved frame in [RF Wiki — Precision Lab](https://www.figma.com/design/ufYJctXMrn48y7MUppT5PB)
3. existing project components and calculation APIs
4. external skill defaults

Do not change a token, interaction grammar, physical color meaning, or anti-slop rule without explicit user approval.

## Architecture

- Astro owns static routes, layouts, prose and MDX content.
- React islands are allowed only for simulators, prediction challenges and state that truly needs client interaction.
- RF math lives in pure TypeScript under `src/lib/rf/`; UI components must not duplicate formulas.
- Every simulator follows `Control → RF model → Linked Views → Cause/Effect Ledger → prediction/explanation`.
- Shared domain types live in `src/types/` and carry units in names or branded wrappers. Never pass an unlabeled bare number across a public RF API when Hz/dBm/Ω/degree ambiguity is possible.
- Content and web simulations use built-in deterministic scenarios only. Educational SCPI parsing/state simulation is allowed under `src/lib/instruments/`; real instrument access stays in local examples under `examples/`. No backend, browser-to-instrument bridge, login, live AI, telemetry or file import.
- Every local equipment example is dry-run first. Transport execution and hazardous source/output enable are separate permissions, identity/module/option checks precede configuration, and cleanup begins with the safest available OFF/abort command in `finally`. A software OFF is never described as a substitute for attenuation, fuse, remote inhibit, interlock or DUT-specific bias sequencing.
- Instrument baselines are pinned in `src/data/instruments.ts`. Do not mix commands across N5182B/N5186A, N9020B/other X-Series analyzer models or measurement applications, E5080B/E5081A/PNA, U2061XA/other U-Series sensors, or N6705C/module families without an explicit applicability note and official Keysight source.

## Component organization

- Astro layout and static learning components: `src/components/astro/`
- React simulator primitives: `src/components/lab/`
- Topic simulators: `src/components/simulators/`
- Responsive SVG views: `src/components/plots/`
- Shared calculation models: `src/lib/rf/`
- Instrument command/state models: `src/lib/instruments/`
- Lesson content: `src/content/lessons/`
- Instrument study content: `src/content/instruments/`

Use PascalCase for components and camelCase for functions. Export public TypeScript types explicitly. Reuse a shared component before creating a topic-specific clone.

## Styling and tokens

- All authored CSS values that express color, spacing, radius, type, z-index, motion or layout width must resolve to a token in `src/styles/tokens.css`.
- Do not hardcode hex values in components or pages. Dynamic SVG output may use semantic CSS variables only.
- IBM Plex Sans KR is the only prose/UI family. IBM Plex Mono is the only data/math/readout family.
- Site-wide dark mode is out of scope. Dark tokens are for instrument and plot surfaces only.
- Cards exist only for independent state or interaction boundaries. Do not nest cards.
- Every interactive component includes default, hover, focus-visible, active, disabled, loading and error behavior when applicable.

## Figma workflow

For Figma-driven code changes:

1. Fetch `get_design_context` for the exact approved node.
2. If large, fetch metadata and then only required child nodes.
3. Fetch a screenshot of the same node.
4. Map Figma variables to `src/styles/tokens.css`; never copy one-off values around the token system.
5. Translate Figma output to Astro/React and project CSS conventions.
6. Validate browser screenshots against Figma at 1440, 1024 and 390px.

For Figma writes, load `figma-use`, work sequentially, return every created/mutated ID, and verify metadata/screenshot before the next build step. Never guess a node ID.

## RF content and visualization

- Each lesson has intuition, practical operation/interpretation, and equation/standard layers.
- LTE and NR normative statements use 3GPP Release 17 references. Equipment behavior uses official vendor documentation where standards do not define it.
- Distinguish convention-dependent quantities and state the convention: FFT normalization, dB reference, S-parameter direction, coupler port naming, available/accepted/delivered power and gain definitions.
- Every plot includes title, axes, units, current settings, marker, direct labels, a text summary and a data-table alternative.
- Never rely on color alone. Use dash/marker/shape/text too.
- Every simulator displays an educational-model disclaimer and measurement limitations.

## Accessibility, performance and verification

- WCAG 2.2 AA, 44px targets, visible focus, keyboard completion and reduced motion are required.
- Static prose ships no unnecessary client JavaScript. Simulator islands use visible or idle hydration as appropriate.
- Before completion run unit tests, type checking, build, Pagefind indexing, Playwright keyboard/flow checks, axe, and screenshot review at 1440/1024/390px.
- RF numeric tests must include deterministic expected values and tolerance, not screenshot-only assertions.
