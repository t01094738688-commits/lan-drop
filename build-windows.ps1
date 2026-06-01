param(
  [ValidateSet("portable", "installer")]
  [string]$Type = "portable"
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

if ($Type -eq "installer") {
  npm run dist:win
} else {
  npm run pack:win
}
