@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ============================================================
REM 本地打包脚本 — Windows
REM ============================================================
REM 用途: 在本地构建 Next.js standalone 产物并打包成 deploy.tar.gz
REM        上传到服务器后用 scripts/server-deploy.sh 部署
REM
REM 用法:
REM   scripts\local-pack.bat
REM
REM 前提:
REM   - 已安装 Node.js 20 + pnpm
REM   - 已安装 Git for Windows（提供 tar 命令）
REM     下载: https://git-scm.com/download/win
REM ============================================================

echo ======================================
echo   AI Newline Center - 本地打包
echo ======================================
echo.

REM 检查 pnpm
where pnpm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 未找到 pnpm，请先安装: npm install -g pnpm
    exit /b 1
)

REM 检查 tar（Git for Windows 自带）
where tar >nul 2>&1
if errorlevel 1 (
    echo [ERROR] 未找到 tar 命令
    echo 请安装 Git for Windows: https://git-scm.com/download/win
    echo 或使用 WSL 运行: bash scripts/local-pack.sh
    exit /b 1
)

echo [1/5] 安装依赖...
call pnpm install --frozen-lockfile
if errorlevel 1 goto :error

echo [2/5] 生成 Prisma Client...
call pnpm prisma generate
if errorlevel 1 goto :error

echo [3/5] 构建 Next.js...
call pnpm build
if errorlevel 1 goto :error

echo [4/5] 整理部署文件...
if exist .deploy-tmp rmdir /s /q .deploy-tmp
mkdir .deploy-tmp\standalone

REM Standalone 产物
xcopy /e /i /q .next\standalone .deploy-tmp\standalone >nul
REM 静态资源
xcopy /e /i /q .next\static .deploy-tmp\standalone\.next\static >nul
REM public（跳过 storage 子目录）
mkdir .deploy-tmp\standalone\public
for /d %%D in (public\*) do (
    if /i not "%%~nxD"=="storage" (
        xcopy /e /i /q "%%D" ".deploy-tmp\standalone\public\%%~nxD" >nul
    )
)
for %%F in (public\*.*) do (
    copy /y "%%F" ".deploy-tmp\standalone\public\" >nul
)

REM Prisma 迁移文件
xcopy /e /i /q prisma .deploy-tmp\prisma >nul
copy /y package.json .deploy-tmp\ >nul
copy /y ecosystem.config.js .deploy-tmp\ >nul
copy /y scripts\server-deploy.sh .deploy-tmp\ >nul

echo [5/5] 压缩打包...
tar -czf deploy.tar.gz -C .deploy-tmp .
if errorlevel 1 goto :error

rmdir /s /q .deploy-tmp

echo.
echo ======================================
echo   打包完成！
echo ======================================
echo   文件: deploy.tar.gz
echo.
echo   下一步:
echo   1. 通过宝塔文件管理器将 deploy.tar.gz 上传到服务器
echo      目标路径: /www/wwwroot/ai-newline-center/
echo   2. 在宝塔终端或 SSH 执行:
echo      cd /www/wwwroot/ai-newline-center
echo      tar -xzf deploy.tar.gz
echo      bash server-deploy.sh
echo ======================================
goto :end

:error
echo.
echo [ERROR] 构建失败，请查看上方错误信息
exit /b 1

:end
endlocal
