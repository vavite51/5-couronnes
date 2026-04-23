param(
  [int[]]$Ports = @(8081, 8787, 19000, 19001, 19006)
)

$ErrorActionPreference = 'SilentlyContinue'

function Get-ListeningProcessIds {
  param([int[]]$TargetPorts)

  $lines = netstat -ano -p tcp
  $ids = @()

  foreach ($line in $lines) {
    foreach ($port in $TargetPorts) {
      if ($line -match (":$port\s") -and $line -match 'LISTENING\s+(\d+)\s*$') {
        $ids += [int]$matches[1]
      }
    }
  }

  return $ids | Sort-Object -Unique
}

$targetPids = Get-ListeningProcessIds -TargetPorts $Ports

if (-not $targetPids -or $targetPids.Count -eq 0) {
  Write-Output '[dev-stop] Aucun process a stopper sur les ports cibles.'
  exit 0
}

foreach ($procId in $targetPids) {
  try {
    Stop-Process -Id $procId -Force -ErrorAction Stop
    Write-Output "[dev-stop] Process stoppe: PID $procId"
  }
  catch {
    Write-Output "[dev-stop] Impossible de stopper PID ${procId}: $($_.Exception.Message)"
  }
}
