param(
  [string]$AppDir = (Split-Path -Parent $PSScriptRoot),
  [string]$ProjectName = "ai_newline_center",
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$AppDir = [System.IO.Path]::GetFullPath($AppDir)
$BuildScript = Join-Path $PSScriptRoot "deploy-build.ps1"

if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
  Write-Host "pm2 was not found. Install it first with npm install -g pm2."
  exit 1
}

& $BuildScript -AppDir $AppDir -SkipInstall:$SkipInstall

$KnownNames = @($ProjectName, "ai-newline-center") | Select-Object -Unique
$MatchedName = $null

foreach ($Name in $KnownNames) {
  & pm2 describe $Name *> $null
  if ($LASTEXITCODE -eq 0) {
    $MatchedName = $Name
    break
  }
}

if ($null -eq $MatchedName) {
  Write-Host "No existing PM2 process found. Starting ecosystem.config.cjs..."
  Set-Location -LiteralPath $AppDir
  & pm2 start ecosystem.config.cjs
} else {
  Write-Host "Reloading PM2 process: $MatchedName"
  & pm2 reload $MatchedName --update-env
}

& pm2 save | Out-Null
Write-Host "Reload finished."
