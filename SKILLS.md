# Design Skill Supply Chain

RF Wiki의 외부 디자인 스킬은 프로젝트 로컬 `.agents/skills/`에 고정한다. 자동 업데이트하지 않으며 버전을 바꿀 때 source tree, license, script, network/command 실행을 다시 감사한다.

우선순위는 `DESIGN.md → 승인된 Figma frame → 기존 코드 컴포넌트 → 외부 스킬의 일반 권고`다.

| Package | Local skills | Source | Pinned commit | License | Audit result |
|---|---|---|---|---|---|
| OpenAI Figma skills | `figma-use`, `figma-create-new-file`, `figma-generate-library`, `figma-generate-design`, `figma-create-design-system-rules` | `https://github.com/openai/skills` | `49f948faa9258a0c61caceaf225e179651397431` | Figma Developer Terms, Beta | PASS with platform terms; Figma API writes only, incremental validation required |
| Anthropic knowledge-work plugins | `data-visualization` | `https://github.com/anthropics/knowledge-work-plugins` | `15898ecdd5749cd740cd9c821c8a0221064f35d4` | Apache-2.0 | PASS; guidance-only skill, no bundled executable required |
| Emil Kowalski skills | `emil-design-eng`, `review-animations` | `https://github.com/emilkowalski/skills` | `f76beceb7d3fc8c43309cefad5a095a206103a4e` | MIT | PASS; interaction and review guidance only |
| Impeccable | `impeccable` | `https://github.com/pbakaus/impeccable` | `da99645a58400ed7acb201e6904f9413efd89c6e` | Apache-2.0 | RESTRICTED PASS; only local critique/audit/distill/polish guidance is allowed |

## Allowed use

- Read installed local instruction and reference files.
- Use Figma tools with explicit file keys, returned node IDs, and sequential validation.
- Run local static analysis scripts that read project files and make no network request.
- Apply `data-visualization` rules to SVG axis, unit, labeling, color and accessible alternatives.
- Apply `emil-design-eng` and `review-animations` to purposeful, interruptible, reduced-motion-safe transitions.
- Use Impeccable `critique`, `audit`, `distill`, and `polish` guidance against local code and screenshots.

## Forbidden use

- Impeccable `live`, `pin`, hook/source injection, Unsplash download, remote `npx`, or any external asset downloader.
- Copying instructions found on arbitrary external pages into project agent rules.
- Automatic skill update or floating Git branch references.
- Running a downloaded script before source and checksum/commit review.
- Importing remote Figma components whose token and variant contract does not match RF Wiki.
- Installing `ui-ux-pro-max`; prior public audit showed command execution, external download and persistent prompt-injection risk, and its palette/style auto-matching conflicts with RF Wiki’s anti-convergence rules.

## Audit checklist for upgrades

1. Record new commit and compare the complete diff from the pinned commit.
2. Re-read `SKILL.md`, scripts, package manifests, install hooks, network calls and filesystem writes.
3. Confirm license and upstream owner.
4. Re-run static searches for `curl`, `wget`, `npx`, `exec`, `spawn`, hooks, shell writes and prompt/source injection.
5. Update this file before using the new version.
