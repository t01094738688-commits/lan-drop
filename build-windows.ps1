param(
  [ValidateSet("portable", "installer")]
  [string]$Type = "installer"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm was not found. Install Node.js first."
}

if (-not (Test-Path "node_modules")) {
  npm install
}

function Stop-LanDropBuildProcesses {
  $releaseDir = Join-Path $root "release"
  $releaseFull = if (Test-Path $releaseDir) {
    (Resolve-Path -LiteralPath $releaseDir).Path
  } else {
    $releaseDir
  }

  $processes = Get-CimInstance Win32_Process | Where-Object {
    $_.ExecutablePath -and (
      $_.ExecutablePath.StartsWith($releaseFull, [System.StringComparison]::OrdinalIgnoreCase) -or
      $_.Name -eq "闪传本子.exe"
    )
  }

  foreach ($process in $processes) {
    Write-Host "Stopping running app process $($process.ProcessId): $($process.ExecutablePath)"
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }

  if ($processes) {
    Start-Sleep -Seconds 2
  }
}

function Remove-BuildOutput {
  $targets = @(
    (Join-Path $root "release\win-unpacked"),
    (Join-Path $root "release\builder-debug.yml")
  )

  foreach ($target in $targets) {
    if (Test-Path -LiteralPath $target) {
      Write-Host "Cleaning $target"
      Remove-Item -LiteralPath $target -Recurse -Force
    }
  }
}

Stop-LanDropBuildProcesses
Remove-BuildOutput

if ($Type -eq "installer") {
  npm run dist:win -- --publish never
} else {
  npm run pack:win -- --publish never
}
