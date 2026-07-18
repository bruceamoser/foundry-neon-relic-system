---
name: create-release
description: 'Create a versioned GitHub release for foundry-neon-relic-system. Semver bump (major/minor/patch), pre-flight checks, build, tag, and publish. USE FOR: "create release", "make release", "publish release", "cut release", "ship it", "bump version and release".'
argument-hint: '<major|minor|patch>'
user-invocable: true
---

# Create Release — foundry-neon-relic-system

Complete end-to-end workflow for cutting a versioned GitHub release of the Neon Relic Foundry VTT system. This skill IS the procedure — follow every step, in order, without skipping.

## Prerequisites

- Working directory: `/home/bruceamoser/Repos/foundry-neon-relic-system`
- Tag format: `v<major>.<minor>.<patch>` (e.g., `v0.6.0`)
- Release artifacts: `neon-relic.zip` + `system.json`
- `gh` CLI authenticated with `repo` scope
- Node.js 22+ and npm available

## Parameter: `<type>`

One of:
- `major` — breaking changes (x.0.0)
- `minor` — new features, backwards-compatible (0.x.0)
- `patch` — bug fixes, backwards-compatible (0.0.x)

## URI Convention

The source-of-truth `static/system.json` MUST keep URIs pointing to `latest`:

```json
"manifest": "https://github.com/bruceamoser/foundry-neon-relic-system/releases/latest/download/system.json",
"download": "https://github.com/bruceamoser/foundry-neon-relic-system/releases/latest/download/neon-relic.zip"
```

This is the correct pattern for Foundry VTT. The `manifest` always resolves to the latest release's `system.json`, and the `download` always fetches the latest `neon-relic.zip`. Do NOT replace these with version-specific URLs in source. The version-specific download URL is set only at release time via `gh release upload`.

## Mandatory 6-Step Workflow

### Step 1 — Pre-Flight Checks

All of these MUST pass before proceeding:

```bash
# 1a. On main, fully up to date
git checkout main
git pull origin main
git status              # MUST show "nothing to commit, working tree clean"

# 1b. No open PRs against main
gh pr list --base main --state open --json number,title
# MUST return [] (empty). If any open PRs exist, stop and resolve them first.

# 1c. No unmerged branches for issues
git branch --merged origin/main | grep 'issue/' || true
# All issue/ branches should be merged and deleted. If any remain, clean them up.

# 1d. Lint check passes
npm run lint

# 1e. Build succeeds
npm run build
```

If any check fails, stop and fix it before continuing.

### Step 2 — Compute & Bump Version

Read the current version from both files:

```bash
# Read current version
CURRENT=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT"
```

Parse the semver components and compute the new version:

```bash
# Compute new version based on <type>
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
case "<type>" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac
NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
echo "New version: $NEW_VERSION"
```

Bump the version in both manifest files:

1. **`package.json`** — update the `"version"` field.
2. **`static/system.json`** — update the `"version"` field.

Verify URIs still point to `latest`:

```bash
grep '"manifest"' static/system.json | grep 'latest/download'
grep '"download"' static/system.json | grep 'latest/download'
```

Both MUST contain `latest/download`. If they contain a specific version number, fix them back to `latest`.

### Step 3 — Build & Commit Version Bump

```bash
# Run production build
npm run build

# Verify dist/ was produced
ls dist/system.json dist/neon-relic.mjs dist/neon-relic.css

# Format
npm run format:fix

# Commit the version bump
git add package.json static/system.json
git commit -m "chore: bump version to $NEW_VERSION"

# Push
git push origin main
```

### Step 4 — Create Git Tag & GitHub Release

Create an annotated tag:

```bash
git tag -a "v${NEW_VERSION}" -m "v${NEW_VERSION}"
git push origin "v${NEW_VERSION}"
```

Create the GitHub release with auto-generated notes and attach build artifacts:

```bash
# Create the ZIP artifact from dist/
cd dist && zip -r ../neon-relic.zip . && cd ..

# Create the release with artifacts
gh release create "v${NEW_VERSION}" \
  --title "v${NEW_VERSION}" \
  --generate-notes \
  --prerelease=false \
  ./neon-relic.zip \
  ./dist/system.json
```

**What this does:**
- Creates a GitHub Release tagged `v${NEW_VERSION}`
- Generates release notes from merged PRs since the last release
- Uploads `neon-relic.zip` (the full system) and `system.json` (the manifest) as release assets
- Foundry VTT resolves `.../latest/download/system.json` → this release's `system.json`
- Foundry VTT resolves `.../latest/download/neon-relic.zip` → this release's `neon-relic.zip`

If the release already exists (e.g., from a CI draft), use:

```bash
gh release upload "v${NEW_VERSION}" ./neon-relic.zip ./dist/system.json --clobber
```

### Step 5 — Verify

```bash
# 5a. Confirm the release exists
gh release view "v${NEW_VERSION}" --json tagName,name,publishedAt,isPrerelease

# 5b. Confirm assets are attached
gh release view "v${NEW_VERSION}" --json assets --jq '.assets[] | "\(.name) — \(.size) bytes"'

# Expected output:
#   neon-relic.zip — <size> bytes
#   system.json — <size> bytes

# 5c. Verify system.json is downloadable and its version matches
curl -sL "https://github.com/bruceamoser/foundry-neon-relic-system/releases/download/v${NEW_VERSION}/system.json" | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).version"
# MUST output: ${NEW_VERSION}

# 5d. Verify the manifest field in the uploaded system.json points to latest
curl -sL "https://github.com/bruceamoser/foundry-neon-relic-system/releases/latest/download/system.json" | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).manifest"
# MUST output: https://github.com/bruceamoser/foundry-neon-relic-system/releases/latest/download/system.json

# 5e. Clean up local ZIP
rm -f neon-relic.zip
```

### Step 6 — Confirm & Clean Up

```bash
# Final status check
git status                          # clean, on main
git branch -a                       # no stale branches
gh release list --limit 3           # new release is at the top
```

## Complete Script (Reference)

For convenience, here is the full procedure as a single script. Replace `<type>` with the actual bump type.

```bash
#!/usr/bin/env bash
set -euo pipefail

BUMP_TYPE="<type>"  # major, minor, or patch
REPO_DIR="/home/bruceamoser/Repos/foundry-neon-relic-system"

cd "$REPO_DIR"

# ── Step 1: Pre-flight ────────────────────────────────
echo "=== Step 1: Pre-flight checks ==="
git checkout main
git pull origin main
[[ -z $(git status --porcelain) ]] || { echo "Working tree not clean"; exit 1; }
OPEN_PRS=$(gh pr list --base main --state open --json number --jq 'length')
[[ "$OPEN_PRS" -eq 0 ]] || { echo "Open PRs exist: $OPEN_PRS"; exit 1; }
npm run lint
npm run build
echo "Pre-flight: OK"

# ── Step 2: Bump version ──────────────────────────────
echo "=== Step 2: Bump version ==="
CURRENT=$(node -p "require('./package.json').version")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
case "$BUMP_TYPE" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *) echo "Invalid bump type: $BUMP_TYPE"; exit 1 ;;
esac
NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
echo "Bumping $CURRENT → $NEW_VERSION"

# Update package.json
node -e "
  const pkg = require('./package.json');
  pkg.version = '${NEW_VERSION}';
  require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update static/system.json
node -e "
  const sys = require('./static/system.json');
  sys.version = '${NEW_VERSION}';
  require('fs').writeFileSync('./static/system.json', JSON.stringify(sys, null, 2) + '\n');
"

# Verify URIs still point to latest
grep -q 'latest/download' static/system.json || { echo "URIs must use 'latest/download'"; exit 1; }
echo "Version bump: OK"

# ── Step 3: Build & commit ────────────────────────────
echo "=== Step 3: Build & commit ==="
npm run build
npm run format:fix
git add package.json static/system.json
git commit -m "chore: bump version to ${NEW_VERSION}"
git push origin main
echo "Build & commit: OK"

# ── Step 4: Tag & release ─────────────────────────────
echo "=== Step 4: Tag & release ==="
git tag -a "v${NEW_VERSION}" -m "v${NEW_VERSION}"
git push origin "v${NEW_VERSION}"

cd dist && zip -r ../neon-relic.zip . && cd ..

gh release create "v${NEW_VERSION}" \
  --title "v${NEW_VERSION}" \
  --generate-notes \
  --prerelease=false \
  ./neon-relic.zip \
  ./dist/system.json

rm -f neon-relic.zip
echo "Release: OK"

# ── Step 5: Verify ────────────────────────────────────
echo "=== Step 5: Verify ==="
gh release view "v${NEW_VERSION}" --json tagName,isPrerelease
gh release view "v${NEW_VERSION}" --json assets --jq '.assets[] | "\(.name) — \(.size) bytes"'
echo "Done! Release v${NEW_VERSION} is live."
```

## Critical Gotchas

- **URIs MUST use `latest/download`** — never replace with versioned URLs in source. This is a Foundry VTT best practice: users always get the latest release when they install/update the system.
- **Version bump in two files** — `package.json` AND `static/system.json`. They must always agree.
- **Build before release** — `dist/` must be fresh. The release uploads `system.json` from `dist/` (which was copied from `static/` during build).
- **`npm run format:fix` before commit** — the pre-commit hook enforces Prettier formatting.
- **Clean up the local ZIP** — `neon-relic.zip` is a temporary build artifact; remove it after upload.
- **Tag format** — must be `v<semver>` (e.g., `v0.6.0`). This matches the GitHub release tag convention used by reference Foundry systems.
- **`gh` CLI** requires `repo` scope. Verify with `gh auth status`.
- **If CI workflow exists** (`.github/workflows/release.yml`), it may also trigger on release publish. The `gh release create` with `--prerelease=false` publishes immediately, so CI will see a published release and may attach additional artifacts. This is fine — `gh release upload --clobber` handles duplicates.

## Reference Repos (Read-Only)

These sibling workspace folders are Foundry VTT modules for code reference only. Never modify them:
- `yearzero-combat-fvtt` — YZE combat module
- `twilight2000-foundry-vtt` — Twilight: 2000 (release workflow reference)
- `vaesen-foundry-vtt` — Vaesen
- `blade-runner-foundry-vtt` — Blade Runner (build pipeline reference)
- `morkborg-foundry-vtt` — Mörk Borg
- `mutant-year-zero` — Mutant: Year Zero
