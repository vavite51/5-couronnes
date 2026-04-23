param(
  [string]$Label = "",
  [string[]]$Paths = @(
    "src/online/RemotePlayScreen.tsx",
    "host-server.js"
  )
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
$snapshotsRoot = Join-Path $projectRoot "snapshots"

if (!(Test-Path $snapshotsRoot)) {
  New-Item -ItemType Directory -Path $snapshotsRoot | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safeLabel = ($Label -replace "[^a-zA-Z0-9_-]", "_").Trim("_")
$snapshotName = if ([string]::IsNullOrWhiteSpace($safeLabel)) { $timestamp } else { "$timestamp-$safeLabel" }
$snapshotDir = Join-Path $snapshotsRoot $snapshotName

New-Item -ItemType Directory -Path $snapshotDir | Out-Null

$savedItems = @()

foreach ($relativePath in $Paths) {
  if ([string]::IsNullOrWhiteSpace($relativePath)) { continue }

  $sourcePath = Join-Path $projectRoot $relativePath
  if (!(Test-Path $sourcePath)) {
    Write-Output "[snapshot-create] ignore (introuvable): $relativePath"
    continue
  }

  $destPath = Join-Path $snapshotDir $relativePath
  $destDir = Split-Path -Parent $destPath
  if (!(Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
  }

  Copy-Item -Path $sourcePath -Destination $destPath -Recurse -Force
  $savedItems += $relativePath
}

$manifest = [ordered]@{
  createdAt = (Get-Date).ToString("o")
  snapshotName = $snapshotName
  projectRoot = $projectRoot
  items = $savedItems
}

$manifestPath = Join-Path $snapshotDir "manifest.json"
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Path $manifestPath -Encoding utf8

Write-Output "[snapshot-create] snapshot cree: $snapshotDir"
Write-Output "[snapshot-create] elements: $($savedItems.Count)"
