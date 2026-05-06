param(
  [string]$AppDir = (Split-Path -Parent $PSScriptRoot),
  [switch]$SkipInstall
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
$EnvExampleFile = Join-Path $AppDir ".env.production.example"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js 20+ was not found. Install it first."
  exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "npm was not found. Verify the Node.js installation."
  exit 1
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Host "pnpm was not found. Installing pnpm globally..."
  & npm install -g pnpm
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
  Write-Host "Missing $EnvFile"
  if (Test-Path -LiteralPath $EnvExampleFile) {
    Write-Host "Create it first:"
    Write-Host "Copy-Item $EnvExampleFile $EnvFile"
  }
  exit 1
}

Set-Location -LiteralPath $AppDir
Import-EnvFile -Path $EnvFile

New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "logs") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "public\storage\covers") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "public\storage\videos") | Out-Null

if (-not $SkipInstall) {
  Write-Host "[1/4] Installing dependencies..."
  & pnpm install --frozen-lockfile
} else {
  Write-Host "[1/4] Skipping dependency install..."
}

Write-Host "[2/4] Generating Prisma Client..."
& pnpm db:generate

Write-Host "[3/4] Running Prisma migrations..."
& pnpm exec prisma migrate deploy

Write-Host "[4/4] Building Next.js app..."
& pnpm build

Write-Host "Build finished."
