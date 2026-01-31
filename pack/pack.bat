@echo off
REM Chrome Extension Packaging Script for Windows
REM This script packages the Chrome extension for distribution

echo ========================================
echo Chrome Extension Packaging Script
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

REM Change to project root directory
cd /d "%~dp0.."
echo Current directory: %CD%
echo.

REM Install dependencies
echo [1/2] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed
echo.

REM Build and package
echo [2/2] Building and packaging extension...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)
echo [OK] Build completed successfully
echo.

echo ========================================
echo Packaging completed!
echo ========================================
echo.
echo Output files are in: pack\out
echo   - my-tab-search-v{version}.crx (for local installation)
echo   - my-tab-search-v{version}.zip (for Chrome Web Store)
echo.
pause
