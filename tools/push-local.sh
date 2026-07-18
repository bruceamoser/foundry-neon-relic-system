#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────
# push-local.sh — Build & deploy Neon Relic to local Foundry VTT
# ────────────────────────────────────────────────────────────
# Usage: ./tools/push-local.sh [--no-build] [--link]
#
#   --no-build   Skip npm run build (use existing dist/)
#   --link       Create symlink from dist/ to Foundry systems
#                (one-time setup; then just npm run build)
# ────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DIST_DIR="${PROJECT_ROOT}/dist"
SYSTEM_ID="neon-relic"

# ── Resolve Foundry data path ─────────────────────────────
# Priority: pathconfig file > hardcoded default
PATHCONFIG_FILE="${PROJECT_ROOT}/pathconfig"
if [[ -f "${PATHCONFIG_FILE}" ]]; then
  FOUNDRY_DATA="$(head -n1 "${PATHCONFIG_FILE}" | tr -d '[:space:]')"
  echo "[push-local] Foundry data path (from pathconfig): ${FOUNDRY_DATA}"
else
  FOUNDRY_DATA="${HOME}/.local/share/FoundryVTT"
  echo "[push-local] Foundry data path (default): ${FOUNDRY_DATA}"
fi

TARGET_DIR="${FOUNDRY_DATA}/Data/systems/${SYSTEM_ID}"

# ── Parse flags ────────────────────────────────────────────
SKIP_BUILD=false
DO_LINK=false
for arg in "$@"; do
  case "$arg" in
    --no-build) SKIP_BUILD=true ;;
    --link)     DO_LINK=true ;;
    *)          echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

# ── Symlink mode ───────────────────────────────────────────
if [[ "$DO_LINK" == true ]]; then
  echo "[push-local] Creating symlink: ${DIST_DIR} → ${TARGET_DIR}"

  # Ensure Foundry systems directory exists
  mkdir -p "$(dirname "${TARGET_DIR}")"

  # Remove existing directory or symlink if present
  if [[ -L "${TARGET_DIR}" ]] || [[ -d "${TARGET_DIR}" ]]; then
    echo "[push-local] Removing existing target: ${TARGET_DIR}"
    rm -rf "${TARGET_DIR}"
  fi

  ln -sfn "${DIST_DIR}" "${TARGET_DIR}"
  echo "[push-local] ✓ Symlink created."
  echo "[push-local] From now on, just run: npm run build"
  echo "[push-local] Then reload Foundry world (F5)."
  exit 0
fi

# ── Validate dist/ exists ──────────────────────────────────
if [[ ! -d "${DIST_DIR}" ]]; then
  echo "[push-local] ERROR: dist/ directory not found at ${DIST_DIR}"
  echo "[push-local] Run a build first, or remove --no-build."
  exit 1
fi

# ── Build ──────────────────────────────────────────────────
if [[ "$SKIP_BUILD" == false ]]; then
  echo "[push-local] Building (NODE_ENV=production)..."
  cd "${PROJECT_ROOT}"
  npm run build
  echo "[push-local] Build complete."
fi

# ── Ensure target directory exists ─────────────────────────
mkdir -p "${TARGET_DIR}"

# ── Sync dist/ → Foundry systems ───────────────────────────
echo "[push-local] Syncing: ${DIST_DIR}/ → ${TARGET_DIR}/"

# If target is a symlink, resolve it and sync to the real location
if [[ -L "${TARGET_DIR}" ]]; then
  REAL_TARGET="$(readlink -f "${TARGET_DIR}")"
  echo "[push-local] Target is a symlink → resolving to: ${REAL_TARGET}"
  TARGET_DIR="${REAL_TARGET}"
fi

rsync -av --delete \
  --exclude='.gitkeep' \
  --exclude='.DS_Store' \
  "${DIST_DIR}/" "${TARGET_DIR}/"

echo ""
echo "[push-local] ✓ Deployed to: ${TARGET_DIR}"
echo "[push-local] Switch to Foundry and reload the world (F5)."
