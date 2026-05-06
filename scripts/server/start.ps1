param(
  [string]$AppDir = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Import-EnvFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      return
    }

    $separatorIndex = $line.IndexOf("=")
    if ($separatorIndex -lt 1) {
      return
    }

    $name = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()

    if (
      (($value.StartsWith('"')) -and ($value.EndsWith('"'))) -or
      (($value.StartsWith("'")) -and ($value.EndsWith("'")))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

$AppDir = [System.IO.Path]::GetFullPath($AppDir)
$EnvFile = Join-Path $AppDir ".env.production"

if (-not (Test-Path -LiteralPath $EnvFile)) {
  Write-Host ""
  Write-Host "Missing $EnvFile"
  Write-Host ""
  Write-Host "Create the production env file first:"
  Write-Host "Copy-Item $AppDir\.env.example $EnvFile"
  exit 1
}

if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
  Write-Host ""
  Write-Host "pm2 was not found. Run npm install -g pm2 first."
  exit 1
}

Set-Location -LiteralPath $AppDir
Import-EnvFile -Path $EnvFile

New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "logs") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "public\storage\covers") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "public\storage\videos") | Out-Null

& pm2 describe ai-newline-center *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Reloading service..."
  & pm2 reload ecosystem.config.cjs --update-env
} else {
  Write-Host "Starting service for the first time..."
  & pm2 start ecosystem.config.cjs
}

& pm2 save | Out-Null

Write-Host ""
Write-Host "Service status:"
& pm2 show ai-newline-center 2>$null
