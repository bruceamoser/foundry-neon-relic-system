# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Build Commands

| Command              | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `npm run dev`        | Development build (NODE_ENV=development, gulp)       |
| `npm run dev:watch`  | Development build with file watcher                  |
| `npm run build`      | Production build (NODE_ENV=production, gulp)         |
| `npm run clean`      | Clean dist/ output                                   |
| `npm run lint`       | ESLint check (JS/MJS)                                |
| `npm run lint:fix`   | ESLint auto-fix                                      |
| `npm run format`     | Prettier check (hbs, js, mjs, json, scss, yaml, yml) |
| `npm run format:fix` | Prettier auto-format                                 |

**Build pipeline:** gulp orchestrates SCSS→CSS, YAML→JSON, esbuild bundle, static copy, and pack compilation.

## Source of Truth Hierarchy

| Layer                    | Path                                   | Mutability                                                |
| ------------------------ | -------------------------------------- | --------------------------------------------------------- |
| **Source files**         | `src/**`                               | Read-write. Edit here for all system code changes         |
| **Static assets**        | `static/**`                            | Read-write. Images, fonts, templates copied as-is to dist |
| **Language files**       | `src/lang/*.yaml`                      | Read-write. Compiled to `dist/lang/*.json` by gulp        |
| **Handlebars templates** | `src/templates/**/*.hbs`               | Read-write. Copied to `dist/templates/`                   |
| **SCSS styles**          | `src/neon-relic.scss`                  | Read-write. Compiled to `dist/neon-relic.css`             |
| **Built output**         | `dist/**`                              | **Generated.** Do not edit directly — run `npm run build` |
| **Compendium packs**     | `dist/packs/`                          | Generated from `src/packs/*.yaml`                         |
| **Reference repos**      | sibling Foundry VTT repos in workspace | Read-only reference. Do NOT modify                        |

## Architecture

- **Foundry target:** v14 (ApplicationV2 sheets, TypeDataModel, ES modules)
- **Entry point:** `src/neon-relic.mjs`
- **Sheet framework:** `ApplicationV2` + `HandlebarsApplicationMixin` throughout
- **Data models:** `foundry.abstract.TypeDataModel` classes (no legacy `template.json`)
- **Dice library:** `yzur` bundled locally in `src/lib/`
- **Actor types:** agent, npc, mob, vehicle, headquarters
- **Item types:** weapon, armor, gear, consumable, artifact, talent, criticalInjury, anchor, darkSecret, upgrade, location, informationCard, subdivision
- **Internationalization:** YAML source (`src/lang/en.yaml`) → JSON via gulp. Locale keys use dot-path format: `NEONRELIC.Section.Key`
- **Actions:** ApplicationV2 `data-action` attributes dispatch to sheet-level `DEFAULT_OPTIONS.actions` handlers. Actions work across all tabs — no per-part wiring needed.

## Issue Workflow

When working through GitHub issues, follow this procedure **one issue at a time**:

### 1. Branch

- Create a branch from `main` named `issue/<number>-<short-description>` (e.g., `issue/344-short-rest-label`).
- Only one issue branch should be active at a time.

### 2. Fix

- Read the issue description and all related files before making changes.
- Make the fix in the source files (`src/**`). Follow the architecture patterns above.
- Run `npm run build` to regenerate `dist/` after source changes.
- Verify the build succeeds with no errors.

### 3. Commit & Push

- Commit with a message in the format: `fix(#<number>): <short summary>`.
- Push the branch.

### 4. Pull Request

- Create a PR targeting `main`.
- The PR description should reference the issue (`Closes #<number>`) and summarize what changed and why.

### 5. Review

- Review the PR diff to confirm no unintended changes, no broken references, and no new issues introduced.
- If the review finds problems, return to step 2 and fix them.
- Repeat until the review passes.

### 6. Merge

- Merge the PR into `main` (squash merge preferred for clean history).
- Delete the issue branch after merge — both local and remote.
- Confirm `main` is clean: no uncommitted changes, no stale branches.

### 7. Verify

- Confirm the issue is closed.
- Confirm the PR is merged and closed.

## Branch & Commit Conventions

- **Branch naming:** `issue/<n>-<slug>` (e.g., `issue/344-short-rest-label`)
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- **Squash merge** preferred for clean `main` history

## Critical Gotchas

- `dist/` is generated — never edit files there directly
- Templates use `data-action` attributes that map to sheet-level action handlers in `agent-sheet.mjs`
- Locale keys in templates use `{{localize 'NEONRELIC.Section.Key'}}` — the key must exist in `src/lang/en.yaml` under the correct YAML parent
- The `yzur` dice library is bundled locally in `src/lib/` — do not replace with npm package
- `.gitignore` ignores `node_modules/`, `dist/` (in some cases keep dist committed for releases), and `.venv/`
