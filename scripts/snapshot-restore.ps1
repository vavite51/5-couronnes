param(
  [Parameter(Mandatory = $true)]
  [string]$Snapshot
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path
$snapshotsRoot = Join-Path $projectRoot "snapshots"

if (!(Test-Path $snapshotsRoot)) {
  throw "[snapshot-restore] dossier snapshots introuvable: $snapshotsRoot"
}

$snapshotPath = if (Test-Path $Snapshot) { (Resolve-Path $Snapshot).Path } else { Join-Path $snapshotsRoot $Snapshot }
if (!(Test-Path $snapshotPath)) {
  throw "[snapshot-restore] snapshot introuvable: $Snapshot"
}

$resolvedSnapshotPath = (Resolve-Path $snapshotPath).Path
if (-not $resolvedSnapshotPath.StartsWith((Resolve-Path $snapshotsRoot).Path, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "[snapshot-restore] chemin snapshot invalide (hors dossier snapshots)."
}

$files = Get-ChildItem -Path $resolvedSnapshotPath -Recurse -File | Where-Object {
  $_.Name -ne "manifest.json"
}

$restoredCount = 0
foreach ($file in $files) {
  $relative = $file.FullName.Substring($resolvedSnapshotPath.Length).TrimStart('\', '/')
  if ([string]::IsNullOrWhiteSpace($relative)) { continue }

  $destination = Join-Path $projectRoot $relative
  $destinationDir = Split-Path -Parent $destination
  if (!(Test-Path $destinationDir)) {
    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
  }

  Copy-Item -Path $file.FullName -Destination $destination -Force
  $restoredCount++
}

Write-Output "[snapshot-restore] snapshot restaure: $resolvedSnapshotPath"
Write-Output "[snapshot-restore] fichiers restaures: $restoredCount"
