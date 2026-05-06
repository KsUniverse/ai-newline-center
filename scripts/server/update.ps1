param(
  [Parameter(Mandatory = $true)]
  [string]$ArchivePath,
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

$ArchivePath = [System.IO.Path]::GetFullPath($ArchivePath)
$AppDir = [System.IO.Path]::GetFullPath($AppDir)
$EnvFile = Join-Path $AppDir ".env.production"
$PrismaVersionFile = Join-Path $AppDir "prisma\.prisma-version"
$PrismaBootstrapDir = Join-Path $env:TEMP "ai-newline-prisma-bootstrap"
$SchemaPath = Join-Path $AppDir "prisma\schema.prisma"

if (-not (Test-Path -LiteralPath $AppDir)) {
  Write-Host "The app directory does not exist. Finish initial deployment first."
  exit 1
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
  Write-Host "Missing $EnvFile. Finish the initial deployment config first."
  exit 1
}

if (-not (Test-Path -LiteralPath $ArchivePath)) {
  Write-Host "Archive was not found: $ArchivePath"
  exit 1
}

Write-Host ""
Write-Host "============================================================"
Write-Host " AI Newline Center - Windows update"
Write-Host "============================================================"

Write-Host ""
Write-Host "[1/4] Extracting new version..."
Expand-Archive -LiteralPath $ArchivePath -DestinationPath $AppDir -Force
New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "logs") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "public\storage\covers") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "public\storage\videos") | Out-Null

Import-EnvFile -Path $EnvFile

Write-Host ""
Write-Host "[2/4] Generating Prisma Client..."
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
Write-Host "[3/4] Running database migrations..."
& npx --yes "prisma@$PrismaVersion" migrate deploy --schema $SchemaPath

Write-Host ""
Write-Host "[4/4] Reloading service..."
& (Join-Path $PSScriptRoot "start.ps1") -AppDir $AppDir

Write-Host ""
Write-Host "Update finished."
