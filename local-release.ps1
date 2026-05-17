<#
.SYNOPSIS
  Build and deploy Neon Relic to local Foundry VTT for testing.
.DESCRIPTION
  Runs a production build, stages output into local-release/neon-relic,
  then copies it to the local Foundry systems folder.
.PARAMETER FoundryDataPath
  Path to the Foundry VTT user data directory.
  Defaults to $env:LOCALAPPDATA\FoundryVTT\Data.
.PARAMETER SkipBuild
  Skip the build step and only copy existing dist output.
#>
param(
  [string]$FoundryDataPath = "$env:LOCALAPPDATA\FoundryVTT\Data",
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$systemId = 'neon-relic'
$projectRoot = $PSScriptRoot
$distDir = Join-Path $projectRoot 'dist'
$releaseDir = Join-Path (Join-Path $projectRoot 'local-release') $systemId
$targetDir = Join-Path (Join-Path $FoundryDataPath 'systems') $systemId

# ── Build ──────────────────────────────────────────────
if (-not $SkipBuild) {
  Write-Host '── Building project...' -ForegroundColor Cyan
  Push-Location $projectRoot
  try {
    npx cross-env NODE_ENV=production gulp build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
  }
  finally { Pop-Location }
}

if (-not (Test-Path $distDir)) {
  throw "dist directory not found at $distDir. Run a build first."
}

# ── Stage into local-release ───────────────────────────
Write-Host '── Staging to local-release...' -ForegroundColor Cyan
if (Test-Path $releaseDir) { Remove-Item $releaseDir -Recurse -Force }
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
Copy-Item -Path "$distDir\*" -Destination $releaseDir -Recurse -Force

# ── Deploy to Foundry ─────────────────────────────────
if (-not (Test-Path (Split-Path $targetDir))) {
  throw "Foundry systems directory not found at $(Split-Path $targetDir). Check FoundryDataPath."
}

Write-Host "── Deploying to $targetDir ..." -ForegroundColor Cyan
if (Test-Path $targetDir) { Remove-Item $targetDir -Recurse -Force }
Copy-Item -Path $releaseDir -Destination $targetDir -Recurse -Force

Write-Host '── Done! Restart Foundry or use the Setup screen to reload.' -ForegroundColor Green
