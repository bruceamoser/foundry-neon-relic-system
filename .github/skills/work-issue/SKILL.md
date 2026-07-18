---
name: work-issue
description: 'Work a GitHub issue in foundry-neon-relic-system end-to-end. USE FOR: "work issue", "fix issue", "resolve issue", "work on issue", any request to address a GitHub issue in this repo. Follows mandatory 7-step workflow: branch → fix → commit → PR → review → merge → verify. NEVER stop early — all 7 steps must complete.'
argument-hint: '<issue-number>'
user-invocable: true
---

# Work Issue — foundry-neon-relic-system

Complete end-to-end workflow for resolving a GitHub issue in the foundry-neon-relic-system repository. This skill IS the procedure — follow every step, in order, without skipping.

## Prerequisites

- Working directory: `/home/bruceamoser/Repos/foundry-neon-relic-system`
- Branch naming: `issue/<N>-<short-slug>` (e.g., `issue/344-short-rest-label`)
- Commit format: `fix(#<N>): <short summary>` (Conventional Commits)
- Squash merge preferred for clean `main` history

## Mandatory 7-Step Workflow

### Step 1 — Branch

```bash
git checkout main && git pull origin main && git checkout -b issue/<N>-<short-slug>
```

- Only one issue branch active at a time.
- Pick a short, descriptive slug based on the issue title.

### Step 2 — Fix

1. Read the issue: `gh issue view <N> --json title,body,state,labels`
2. Read all affected source files (`src/**`). Do NOT edit `dist/` directly.
3. Implement the fix following the architecture patterns in [AGENTS.md](../../../AGENTS.md):
   - `ApplicationV2` + `HandlebarsApplicationMixin` for sheets
   - `TypeDataModel` classes for data (no legacy `template.json`)
   - `data-action` attributes map to sheet-level `DEFAULT_OPTIONS.actions`
   - Locale keys use dot-path: `NEONRELIC.Section.Key` in `src/lang/en.yaml`
   - Templates in `src/templates/`, SCSS in `src/neon-relic.scss`
4. Run `npm run build` — must succeed with zero errors.
5. Run `npm run lint` — must have zero new errors (pre-existing warnings OK).
6. Run `npm run format:fix` to ensure Prettier compliance.

### Step 3 — Commit & Push

```bash
git add -A
git commit -m 'fix(#<N>): <short summary>'
git push origin issue/<N>-<short-slug>
```

- Use the `fix(#<N>):` conventional commit prefix.
- Summary should be concise and describe what changed.

### Step 4 — Pull Request

```bash
gh pr create \
  --title "fix(#<N>): <short summary>" \
  --body "## Summary

  Fixes #<N> — <brief description>.

  ### Changes
  - <list of changes>

  ### Files Changed
  - \`path/to/file\` — <what changed>" \
  --base main
```

- PR body MUST include `Closes #<N>` or `Fixes #<N>`.
- If `gh pr create` prompts for branch destination, select `bruceamoser/foundry-neon-relic-system`.

### Step 5 — Review

1. Check PR details: `gh pr view <PR-NUMBER> --json title,state,mergeable,files`
2. Read the full diff: `gh pr diff <PR-NUMBER>`
3. Verify:
   - Only intended files changed
   - No broken cross-references
   - No new contradictions introduced
   - No unintended formatting-only changes outside modified files
4. If problems found, fix them (go back to Step 2) and force-push the branch.
5. If clean, proceed to Step 6.

### Step 6 — Merge

```bash
gh pr merge <PR-NUMBER> --squash --delete-branch
```

Confirm:
- Branch deleted locally: `git branch -d issue/<N>-<short-slug>` (if not auto-deleted)
- Branch deleted on remote (auto-handled by `--delete-branch`)
- Switched back to `main`

### Step 7 — Verify

```bash
git status                          # clean working tree, on main
gh issue view <N> --json state,closed --jq '{state, closed}'  # state=CLOSED
gh pr view <PR-NUMBER> --json state,mergedAt --jq '{state, mergedAt}'  # state=MERGED
```

All three must pass:
- `main` clean, up to date with `origin/main`
- Issue is `CLOSED`
- PR is `MERGED`

## Critical Gotchas

- **Never edit `dist/`** — it's generated. Changes go in `src/`.
- **Build after source changes** — `npm run build` regenerates `dist/`.
- **Format before commit** — `npm run format:fix` or the pre-commit hook will reject.
- **Locale keys** — templates use `{{localize 'NEONRELIC.Section.Key'}}`; the key MUST exist in `src/lang/en.yaml`.
- **`data-action` attributes** — must match an action name in `DEFAULT_OPTIONS.actions` on the sheet class.
- **Squash merge preferred** — keeps `main` history clean.
- **DO NOT stop after Step 4** — complete all 7 steps every time.

## Reference Repos (Read-Only)

These sibling workspace folders are Foundry VTT modules for code reference only. Never modify them:
- `yearzero-combat-fvtt` — YZE combat module
- `twilight2000-foundry-vtt` — Twilight: 2000
- `vaesen-foundry-vtt` — Vaesen
- `blade-runner-foundry-vtt` — Blade Runner
- `morkborg-foundry-vtt` — Mörk Borg
- `mutant-year-zero` — Mutant: Year Zero
