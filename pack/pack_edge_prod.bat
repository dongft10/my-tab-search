@echo off
REM Edge Extension Packaging Script for Production Environment
REM This script packages the Chrome extension for Edge Add-ons release

echo ========================================
echo Edge Extension Packaging Script
REM Target Environment: PRODUCTION (Edge Add-ons)
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js is installed
echo.

REM Change to chrome-extension directory (parent of pack directory)
cd /d %~dp0..
echo Current directory: %CD%
echo.

REM Set environment variable for target environment
set EXTENSION_ENV=prod
echo [OK] Target environment: %EXTENSION_ENV%
echo.

REM Install dependencies
echo [1/3] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed
echo.

REM Build the extension
echo [2/3] Building extension...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)
echo [OK] Build completed
echo.

REM Replace manifest.json with Edge-specific version
echo [3/3] Preparing Edge-specific manifest...
copy /Y manifest.edge.json pack\out\build\manifest.json
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to copy Edge manifest
    pause
    exit /b 1
)
echo [OK] Edge manifest applied
echo.

REM Package the extension
echo Packaging for Edge Add-ons...
call npm run package -- --skip-compress
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Packaging failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo Edge Packaging completed!
echo ========================================
echo.
echo Output files are in: pack\out
echo   - my-tab-search-v{version}.zip (for Edge Add-ons)
echo.
echo Warning: This package is configured for EDGE ADD-ONS
echo.

:: 等待 3 秒后自动退出
timeout /t 3 /nobreak

:: 脚本结束会自动退出，也可以显式退出
exit
