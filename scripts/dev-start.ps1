param(
  [switch]$ClearCache,
  [int]$WebPort = 8081,
  [int]$HostPort = 8787
)

$ErrorActionPreference = 'SilentlyContinue'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
$stopScript = Join-Path $scriptDir 'dev-stop.ps1'

function Wait-Port {
  param(
    [int]$Port,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    $isOpen = netstat -ano -p tcp | Select-String -Pattern ":$Port\s" | Select-String -Pattern 'LISTENING'
    if ($isOpen) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }

  return $false
}

if (Test-Path $stopScript) {
  & $stopScript -Ports @($WebPort, $HostPort, 19000, 19001, 19006) | Out-Host
}

Start-Sleep -Milliseconds 600

$hostProcess = Start-Process -FilePath 'node' -ArgumentList 'host-server.js' -WorkingDirectory $projectRoot -PassThru

$watchEnv = 'set CHOKIDAR_USEPOLLING=1&& set CHOKIDAR_INTERVAL=300&& set WATCHPACK_POLLING=true&&'
$webCommand = if ($ClearCache) {
  "$watchEnv npx expo start --web -c"
}
else {
  "$watchEnv npx expo start --web"
}

$webProcess = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $webCommand -WorkingDirectory $projectRoot -PassThru

$hostReady = Wait-Port -Port $HostPort -TimeoutSeconds 20
$webReady = Wait-Port -Port $WebPort -TimeoutSeconds 90

$localIp = ipconfig |
  Select-String -Pattern 'IPv4' |
  ForEach-Object {
    if ($_.Line -match ':\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\s*$') { $matches[1] }
  } |
  Where-Object { $_ -ne '127.0.0.1' } |
  Select-Object -First 1

if (-not $localIp) { $localIp = '127.0.0.1' }

Write-Output "[dev-start] Host PID: $($hostProcess.Id) | Pret: $hostReady"
Write-Output "[dev-start] Web PID: $($webProcess.Id) | Pret: $webReady"
Write-Output "[dev-start] URL web local: http://127.0.0.1:$WebPort"
Write-Output "[dev-start] URL web LAN:   http://${localIp}:$WebPort"
Write-Output "[dev-start] URL websocket: ws://${localIp}:$HostPort"
