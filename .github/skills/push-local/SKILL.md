---
name: push-local
description: 'Build and push the Neon Relic system to a local Foundry VTT instance for testing. USE FOR: "push local", "deploy local", "push to foundry", "test locally", "update local foundry", "push to local instance".'
user-invocable: true
---

# Push Local — foundry-neon-relic-system

Build the Neon Relic Foundry VTT system and deploy it to a local Foundry VTT instance for immediate testing.

## Prerequisites

- Working directory: `/home/bruceamoser/Repos/foundry-neon-relic-system`
- Local Foundry VTT installed at: `/home/bruceamoser/Desktop/FoundryVTT-Linux-14.365`
- Foundry user data at: `/home/bruceamoser/.local/share/FoundryVTT/Data`
- System ID: `neon-relic` (from `static/system.json`)
- Build output: `dist/` → target: `Data/systems/neon-relic/`

## Two Approaches

### Option A — Symlink (recommended, one-time setup)

Create a symlink so Foundry reads directly from `dist/`. After the initial setup, you only need `npm run build` — Foundry picks up changes immediately with a world reload (F5 in Foundry).

**One-time setup:**

```bash
# Create the symlink (only needed once)
ln -sfn /home/bruceamoser/Repos/foundry-neon-relic-system/dist \
  /home/bruceamoser/.local/share/FoundryVTT/Data/systems/neon-relic
```

**Then every change cycle:**

```bash
npm run build
# Reload Foundry world (F5) — done.
```

To verify the symlink exists: `ls -la /home/bruceamoser/.local/share/FoundryVTT/Data/systems/neon-relic`

> **Important:** Foundry only scans for **new** systems on full startup. If this is the first time installing the system (or re-creating a deleted symlink), you must **restart Foundry entirely** — not just reload the world. After the initial discovery, a world reload (F5) is sufficient to pick up build changes.
>
> **v12+:** Foundry watches the filesystem and auto-detects changes. **v11 and earlier:** press F5 after each build.

### Option B — Direct Copy (every push)

If you prefer an explicit copy (no symlink), use the `push-local.sh` script. This does a full `rsync` of `dist/` into the Foundry systems folder.

```bash
./tools/push-local.sh
```

The script:
1. Runs `npm run build` (production build)
2. Syncs `dist/` → `Data/systems/neon-relic/` via `rsync --delete`
3. Reports what was synced

## Workflow

### Step 1 — Ensure Clean State

```bash
git status
```

You don't need a clean git state to push locally — uncommitted changes are fine. Local pushes are for testing as-you-go.

### Step 2 — Build & Push

**If symlink is set up (Option A):**

```bash
npm run build
```

That's it. Foundry reads `dist/` directly. Reload the world (F5).

**If using direct copy (Option B):**

```bash
./tools/push-local.sh
```

### Step 3 — Reload Foundry

- **First-time install or re-created symlink:** Restart Foundry entirely (close & re-open). Foundry only discovers new systems at startup.
- **After each build (symlink already active):** Press **F5** in Foundry to reload the world.
- **Alternative:** From the Foundry setup screen, **Ctrl+click** the world name → "Reload World".
- Verify your changes appear.

### Step 4 — Check Foundry Console

If something doesn't work:
1. In Foundry, press **F12** to open Developer Tools
2. Check the **Console** tab for errors
3. Common issues: missing locale keys, broken template paths, module load errors

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| System doesn't appear in Foundry | `system.json` not found | Check symlink/copy target has `system.json` at root |
| "Error: System not found" | Wrong system ID or path | Verify `static/system.json` has `"id": "neon-relic"` |
| Stale content after build | Foundry cache | F5 reload, or restart Foundry |
| Locale keys showing as `NEONRELIC.X.Y` | YAML→JSON not compiled | Run `npm run build` (gulp compiles YAML) |
| Templates not updating | Symlink broken or copy incomplete | Check `ls dist/templates/` and target |

## Script Reference

The `tools/push-local.sh` script handles Option B. It is a standalone bash script that:
- Reads the Foundry data path from `pathconfig` (fallback: hardcoded default)
- Runs the production build
- Uses `rsync --delete` to mirror `dist/` into the Foundry systems folder
- Excludes `.gitkeep` and other non-essential files
