[CmdletBinding()]
param(
  [switch]$ResurrectOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$AppName = "ai-newline-center"
$AppDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvFile = Join-Path $AppDir ".env.production"
$Pm2Home = "C:\ProgramData\pm2"
$NpmPrefix = "C:\ProgramData\npm"
$NpmCache = "C:\ProgramData\npm-cache"

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

function Get-Pm2App {
  param([string]$Pm2Command)

  $json = & $Pm2Command jlist 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($json)) {
    return $null
  }

  $apps = @($json | ConvertFrom-Json)
  return $apps | Where-Object { $_.name -eq $AppName } | Select-Object -First 1
}

Set-Location $AppDir
Set-SharedEnvironment
$pm2Command = Get-Pm2Command

if ($ResurrectOnly) {
  Write-Step "使用 PM2 恢复开机自启进程..."
  & $pm2Command resurrect
  if ($LASTEXITCODE -ne 0) {
    throw "PM2 resurrect 执行失败"
  }
  exit 0
}

if (-not (Test-Path $EnvFile)) {
  throw "未找到 $EnvFile，请先根据 .env.production.example 创建生产环境配置"
}

Import-DotEnv -Path $EnvFile

New-Item -ItemType Directory -Path (Join-Path $AppDir "logs") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $AppDir "public\storage\covers") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $AppDir "public\storage\videos") -Force | Out-Null

$app = Get-Pm2App -Pm2Command $pm2Command

if ($null -eq $app) {
  Write-Step "首次启动服务..."
  & $pm2Command start ecosystem.config.cjs
  if ($LASTEXITCODE -ne 0) {
    throw "PM2 start 执行失败"
  }
} elseif ($app.pm2_env.status -eq "online") {
  Write-Step "热重载服务..."
  & $pm2Command reload ecosystem.config.cjs --update-env
  if ($LASTEXITCODE -ne 0) {
    & $pm2Command restart ecosystem.config.cjs --update-env
    if ($LASTEXITCODE -ne 0) {
      throw "PM2 reload/restart 执行失败"
    }
  }
} else {
  Write-Step "重新启动已存在的 PM2 进程..."
  & $pm2Command restart ecosystem.config.cjs --update-env
  if ($LASTEXITCODE -ne 0) {
    throw "PM2 restart 执行失败"
  }
}

& $pm2Command save
if ($LASTEXITCODE -ne 0) {
  throw "PM2 save 执行失败"
}

Write-Step "服务运行状态:"
& $pm2Command show $AppName
