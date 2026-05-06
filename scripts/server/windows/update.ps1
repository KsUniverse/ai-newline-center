[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ArchivePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$AppName = "ai-newline-center"
$AppDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvFile = Join-Path $AppDir ".env.production"
$PrismaVersionFile = Join-Path $AppDir "prisma\.prisma-version"
$BootstrapDir = Join-Path $env:TEMP "ai-newline-prisma-bootstrap"
$Pm2Home = "C:\ProgramData\pm2"
$NpmPrefix = "C:\ProgramData\npm"
$NpmCache = "C:\ProgramData\npm-cache"
$StartScript = Join-Path $PSScriptRoot "start.ps1"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host $Message
}

function Set-SharedEnvironment {
  [Environment]::SetEnvironmentVariable("PM2_HOME", $Pm2Home, "Process")
  [Environment]::SetEnvironmentVariable("NPM_CONFIG_PREFIX", $NpmPrefix, "Process")
  [Environment]::SetEnvironmentVariable("NPM_CONFIG_CACHE", $NpmCache, "Process")
}

function Get-Pm2Command {
  $preferred = Join-Path $NpmPrefix "pm2.cmd"
  if (Test-Path $preferred) {
    return $preferred
  }

  $command = Get-Command "pm2.cmd" -ErrorAction SilentlyContinue
  if ($null -ne $command) {
    return $command.Source
  }

  throw "未找到 pm2.cmd，请先运行 scripts\windows\setup.ps1"
}

function Import-DotEnv {
  param([string]$Path)

  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) {
      continue
    }

    $separatorIndex = $trimmed.IndexOf("=")
    if ($separatorIndex -lt 1) {
      continue
    }

    $name = $trimmed.Substring(0, $separatorIndex).Trim()
    $value = $trimmed.Substring($separatorIndex + 1).Trim()

    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

function Invoke-PrismaBootstrap {
  param([string]$NpmCommand)

  $prismaVersion = if (Test-Path $PrismaVersionFile) {
    (Get-Content -LiteralPath $PrismaVersionFile -Raw).Trim()
  } else {
    "6"
  }

  New-Item -ItemType Directory -Path $BootstrapDir -Force | Out-Null

  $bootstrapPackageJson = Join-Path $BootstrapDir "package.json"
  if (-not (Test-Path $bootstrapPackageJson)) {
    Set-Content -LiteralPath $bootstrapPackageJson -Encoding UTF8 -Value '{"name":"ai-newline-prisma-bootstrap","private":true}'
  }

  Write-Host "  安装 prisma@$prismaVersion 与 @prisma/client@$prismaVersion ..."
  & $NpmCommand install --prefix $BootstrapDir --no-save --omit=dev "prisma@$prismaVersion" "@prisma/client@$prismaVersion"
  if ($LASTEXITCODE -ne 0) {
    throw "npm install Prisma 工具链失败"
  }

  $appPrismaClientDir = (Resolve-Path (Join-Path $AppDir "node_modules\@prisma\client")).Path
  $appPrismaRuntimeDir = Join-Path $appPrismaClientDir "runtime"
  $bootstrapPrismaRuntimeDir = Join-Path $BootstrapDir "node_modules\@prisma\client\runtime"

  if (Test-Path $appPrismaRuntimeDir) {
    Remove-Item -LiteralPath $appPrismaRuntimeDir -Recurse -Force
  }

  Copy-Item -LiteralPath $bootstrapPrismaRuntimeDir -Destination $appPrismaRuntimeDir -Recurse -Force

  $prismaCli = Join-Path $BootstrapDir "node_modules\.bin\prisma.cmd"
  $schemaPath = Join-Path $AppDir "prisma\schema.prisma"

  & $prismaCli generate --schema $schemaPath
  if ($LASTEXITCODE -ne 0) {
    throw "Prisma generate 执行失败"
  }

  & $prismaCli migrate deploy --schema $schemaPath
  if ($LASTEXITCODE -ne 0) {
    throw "Prisma migrate deploy 执行失败"
  }
}

if (-not (Test-Path $ArchivePath)) {
  throw "压缩包不存在: $ArchivePath"
}

if (-not (Test-Path $EnvFile)) {
  throw "未找到 $EnvFile，请先完成首次部署"
}

Set-Location $AppDir
Set-SharedEnvironment

Write-Host ""
Write-Host "============================================================"
Write-Host "  AI Newline Center - Windows Server 更新"
Write-Host "============================================================"

Write-Step "[1/4] 停止现有 PM2 进程..."
$pm2Command = Get-Pm2Command
& $pm2Command delete $AppName 2>$null

Write-Step "[2/4] 解压新版本..."
$resolvedArchive = (Resolve-Path -LiteralPath $ArchivePath).Path
Expand-Archive -LiteralPath $resolvedArchive -DestinationPath $AppDir -Force
Write-Host "  ✓ 解压完成 (.env.production 和 public\storage\ 不在包内，已保留)"

New-Item -ItemType Directory -Path (Join-Path $AppDir "logs") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $AppDir "public\storage\covers") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $AppDir "public\storage\videos") -Force | Out-Null

Write-Step "[3/4] 生成 Prisma Client 并执行迁移..."
$npmCommand = Get-Command "npm.cmd" -ErrorAction Stop
Import-DotEnv -Path $EnvFile
Invoke-PrismaBootstrap -NpmCommand $npmCommand.Source

Write-Step "[4/4] 启动新版本..."
& PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File $StartScript
if ($LASTEXITCODE -ne 0) {
  throw "start.ps1 执行失败"
}

Write-Host ""
Write-Host "============================================================"
Write-Host "  更新完成"
Write-Host "============================================================"
