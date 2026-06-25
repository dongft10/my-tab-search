@echo off
REM Chrome Extension Packaging Script for PRE-PRODUCTION Environment
REM Same as production, but KEEPS the manifest key to keep extension ID stable.
REM Use this for manually testing production backend connection before CWS submission.

echo ========================================
echo Chrome Extension Packaging Script
echo Target Environment: PRE-PRODUCTION
echo (Production backend + stable extension ID)
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
echo [OK] Target environment: %EXTENSION_ENV% (production backend)
echo [OK] Manifest key: KEPT (stable extension ID)
echo.

REM Install dependencies
echo [1/2] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed.
echo.

REM Build (with --keep-key to preserve extension ID) and package
echo [2/2] Building and packaging extension...
call node build.config.js --env=prod --keep-key && npm run package
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)
echo [OK] Build completed successfully.
echo.

echo ========================================
echo Pre-production packaging completed!
echo ========================================
echo.
echo Output files are in: pack\out
echo   - my-tab-search-v{version}.crx (for local installation)
echo   - my-tab-search-v{version}.zip
echo.
echo Note: The extension ID is STABLE (key preserved).
echo Use this build for pre-submission testing against production backend.
echo.

timeout /t 3 /nobreak
exit
