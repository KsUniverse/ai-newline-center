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
$EnvExampleFile = Join-Path $AppDir ".env.example"
$PrismaVersionFile = Join-Path $AppDir "prisma\.prisma-version"
$PrismaBootstrapDir = Join-Path $env:TEMP "ai-newline-prisma-bootstrap"
$SchemaPath = Join-Path $AppDir "prisma\schema.prisma"

Write-Host ""
Write-Host "============================================================"
Write-Host " AI Newline Center - Windows initial deployment"
Write-Host "============================================================"

Write-Host ""
Write-Host "[1/5] Checking runtime..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js 20+ was not found. Install it first and retry."
  exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "npm was not found. Verify the Node.js installation."
  exit 1
}

Write-Host "Node.js: $(& node --version)"

Write-Host ""
Write-Host "[2/5] Checking PM2..."
if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
  Write-Host "pm2 was not found. Installing globally..."
  & npm install -g pm2
}

Write-Host "PM2: $(& pm2 --version)"

Write-Host ""
Write-Host "[3/5] Checking env configuration..."
if (-not (Test-Path -LiteralPath $EnvFile)) {
  Write-Host ".env.production was not found. Create it first."
  if (Test-Path -LiteralPath $EnvExampleFile) {
    Write-Host "Suggested command: Copy-Item $EnvExampleFile $EnvFile"
  }

  Write-Host "After saving the file, rerun:"
  Write-Host "powershell -ExecutionPolicy Bypass -File $PSScriptRoot\setup.ps1 -AppDir $AppDir"
  exit 0
}

Import-EnvFile -Path $EnvFile

Write-Host ""
Write-Host "[4/5] Generating Prisma Client..."
if (Test-Path -LiteralPath $PrismaVersionFile) {
  $PrismaVersion = (Get-Content -LiteralPath $PrismaVersionFile -Raw).Trim()
} else {
  $PrismaVersion = "6"
}

New-Item -ItemType Directory -Force -Path $PrismaBootstrapDir | Out-Null
$BootstrapPackageJson = Join-Path $PrismaBootstrapDir "package.json"

if (-not (Test-Path -LiteralPath $BootstrapPackageJson)) {
  @"
{
  "name": "ai-newline-prisma-bootstrap",
  "private": true
}
"@ | Set-Content -LiteralPath $BootstrapPackageJson
}

Write-Host "Installing prisma@$PrismaVersion and @prisma/client@$PrismaVersion ..."
& npm install --prefix $PrismaBootstrapDir --no-save --omit=dev "prisma@$PrismaVersion" "@prisma/client@$PrismaVersion"

$AppPrismaClientDir = (& node -e "const fs=require('node:fs'); console.log(fs.realpathSync(process.argv[1]))" (Join-Path $AppDir "node_modules\@prisma\client")).Trim()
$AppPrismaRuntimeDir = Join-Path $AppPrismaClientDir "runtime"
$BootstrapPrismaRuntimeDir = Join-Path $PrismaBootstrapDir "node_modules\@prisma\client\runtime"

if (Test-Path -LiteralPath $AppPrismaRuntimeDir) {
  Remove-Item -LiteralPath $AppPrismaRuntimeDir -Recurse -Force
}

Copy-Item -LiteralPath $BootstrapPrismaRuntimeDir -Destination $AppPrismaRuntimeDir -Recurse

& (Join-Path $PrismaBootstrapDir "node_modules\.bin\prisma.cmd") generate --schema $SchemaPath

Write-Host ""
Write-Host "[5/5] Running migrations and starting service..."
& npx --yes "prisma@$PrismaVersion" migrate deploy --schema $SchemaPath
& (Join-Path $PSScriptRoot "start.ps1") -AppDir $AppDir

Write-Host ""
Write-Host "Initial deployment finished."
