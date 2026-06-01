$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing desktop dependencies..."
  npm install
}

npm run desktop
