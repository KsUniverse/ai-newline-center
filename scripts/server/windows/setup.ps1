[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$AppDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvFile = Join-Path $AppDir ".env.production"
$PrismaVersionFile = Join-Path $AppDir "prisma\.prisma-version"
$BootstrapDir = Join-Path $env:TEMP "ai-newline-prisma-bootstrap"
$Pm2Home = "C:\ProgramData\pm2"
$NpmPrefix = "C:\ProgramData\npm"
$NpmCache = "C:\ProgramData\npm-cache"
$TaskName = "AI Newline Center PM2 Resurrect"
$StartScript = Join-Path $PSScriptRoot "start.ps1"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host $Message
}

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-Command {
  param([string]$Name)

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($null -eq $command) {
    throw "未找到命令 $Name，请先安装 Node.js 20+"
  }

  return $command.Source
}

function Set-MachineEnvironment {
  [Environment]::SetEnvironmentVariable("PM2_HOME", $Pm2Home, "Machine")
  [Environment]::SetEnvironmentVariable("NPM_CONFIG_PREFIX", $NpmPrefix, "Machine")
  [Environment]::SetEnvironmentVariable("NPM_CONFIG_CACHE", $NpmCache, "Machine")

  [Environment]::SetEnvironmentVariable("PM2_HOME", $Pm2Home, "Process")
  [Environment]::SetEnvironmentVariable("NPM_CONFIG_PREFIX", $NpmPrefix, "Process")
  [Environment]::SetEnvironmentVariable("NPM_CONFIG_CACHE", $NpmCache, "Process")
}

function Grant-DirectoryAccess {
  param([string]$Path)

  New-Item -ItemType Directory -Path $Path -Force | Out-Null
  & icacls $Path /grant "*S-1-5-18:(OI)(CI)F" /grant "*S-1-5-32-544:(OI)(CI)F" /grant "*S-1-5-11:(OI)(CI)M" /T /C | Out-Null
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

function Register-ResurrectTask {
  $actionArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$StartScript`" -ResurrectOnly"
  $action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument $actionArgs
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
}

if (-not (Test-IsAdministrator)) {
  throw "请使用管理员身份运行 setup.ps1"
}

Set-Location $AppDir

Write-Host ""
Write-Host "============================================================"
Write-Host "  AI Newline Center - Windows Server 初始化"
Write-Host "============================================================"

Write-Step "[1/6] 检查 Node.js..."
$nodeCommand = Ensure-Command -Name "node.exe"
$npmCommand = Ensure-Command -Name "npm.cmd"
Write-Host "  Node: $(& $nodeCommand --version)"
Write-Host "  npm : $(& $npmCommand --version)"

Write-Step "[2/6] 准备 PM2 共享目录..."
Set-MachineEnvironment
Grant-DirectoryAccess -Path $NpmPrefix
Grant-DirectoryAccess -Path $NpmCache
Grant-DirectoryAccess -Path $Pm2Home
& $npmCommand config set prefix $NpmPrefix --global | Out-Null
& $npmCommand config set cache $NpmCache --global | Out-Null

$machinePolicy = Get-ExecutionPolicy -Scope LocalMachine
if ($machinePolicy -in @("Undefined", "Restricted")) {
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine -Force
}

Write-Step "[3/6] 安装 PM2..."
& $npmCommand install -g pm2
if ($LASTEXITCODE -ne 0) {
  throw "PM2 安装失败"
}

Write-Step "[4/6] 检查环境变量配置..."
if (-not (Test-Path $EnvFile)) {
  Write-Host ""
  Write-Host "  ⚠  未找到 .env.production，需要先创建配置文件!"
  Write-Host ""
  Write-Host "  操作步骤:"
  Write-Host "  1. cd $AppDir"
  Write-Host "  2. copy .env.production.example .env.production"
  Write-Host "  3. 用编辑器打开 .env.production 填写以下必填项:"
  Write-Host "       DATABASE_URL   = mysql://用户名:密码@127.0.0.1:3306/数据库名"
  Write-Host "       NEXTAUTH_SECRET= 随机32位密钥"
  Write-Host "       NEXTAUTH_URL   = http://你的服务器公网IP:3000"
  Write-Host "       AUTH_TRUST_HOST= true"
  Write-Host "       CRAWLER_API_URL= http://爬虫服务地址:端口"
  Write-Host ""
  Write-Host "  配置完成后，重新以管理员身份运行: PowerShell -ExecutionPolicy Bypass -File $PSCommandPath"
  Write-Host ""
  exit 0
}
Import-DotEnv -Path $EnvFile

Write-Step "[5/6] 生成 Prisma Client 并执行迁移..."
Invoke-PrismaBootstrap -NpmCommand $npmCommand

Write-Step "[6/6] 启动服务并注册开机自启..."
& PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File $StartScript
if ($LASTEXITCODE -ne 0) {
  throw "start.ps1 执行失败"
}
Register-ResurrectTask

Write-Host ""
Write-Host "============================================================"
Write-Host "  初始化完成"
Write-Host "  应用目录: $AppDir"
Write-Host "  开机任务: $TaskName"
Write-Host "============================================================"
