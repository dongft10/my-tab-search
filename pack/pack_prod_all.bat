@echo off
REM ============================================================
REM  pack_all.bat - One-click packaging for BOTH extension stores
REM
REM  Produces (in pack\out):
REM    my-tab-search-v{version}-chrome.zip   -> Chrome Web Store
REM    my-tab-search-v{version}-edge.zip     -> Edge Add-ons
REM    (plus matching .crx for local install)
REM
REM  Version is read dynamically from manifest.json.
REM  Both packages are prod builds (no "key" field in manifest).
REM  Output files are renamed per market to avoid overwriting.
REM ============================================================

cd /d "%~dp0.."
echo Working dir: %CD%
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed.
    goto :fail
)

REM --- read version from manifest.json (no hardcoding) ---
for /f "usebackq delims=" %%v in (`node -p "require('./manifest.json').version"`) do set "VERSION=%%v"
if not defined VERSION (
    echo [ERROR] Failed to read version from manifest.json
    goto :fail
)
echo Version detected: %VERSION%
echo.

set EXTENSION_ENV=prod

REM --- clean stale outputs of this version to avoid overwrite prompts ---
echo [CLEAN] Removing old packages for v%VERSION% ...
if exist "pack\out\my-tab-search-v%VERSION%.zip"         del /Q "pack\out\my-tab-search-v%VERSION%.zip"
if exist "pack\out\my-tab-search-v%VERSION%.crx"         del /Q "pack\out\my-tab-search-v%VERSION%.crx"
if exist "pack\out\my-tab-search-v%VERSION%-chrome.zip"  del /Q "pack\out\my-tab-search-v%VERSION%-chrome.zip"
if exist "pack\out\my-tab-search-v%VERSION%-chrome.crx"  del /Q "pack\out\my-tab-search-v%VERSION%-chrome.crx"
if exist "pack\out\my-tab-search-v%VERSION%-edge.zip"    del /Q "pack\out\my-tab-search-v%VERSION%-edge.zip"
if exist "pack\out\my-tab-search-v%VERSION%-edge.crx"    del /Q "pack\out\my-tab-search-v%VERSION%-edge.crx"

REM ===================== CHROME =====================
echo.
echo ========== [1/2] CHROME package ==========
echo Building (prod)...
call npm run build
if %ERRORLEVEL% NEQ 0 goto :fail
echo Packaging...
call npm run package
if %ERRORLEVEL% NEQ 0 goto :fail

if not exist "pack\out\my-tab-search-v%VERSION%.zip" (
    echo [ERROR] Chrome ZIP not found after packaging
    goto :fail
)
if exist "pack\out\my-tab-search-v%VERSION%.zip" move /Y "pack\out\my-tab-search-v%VERSION%.zip" "pack\out\my-tab-search-v%VERSION%-chrome.zip" >nul
if exist "pack\out\my-tab-search-v%VERSION%.crx" move /Y "pack\out\my-tab-search-v%VERSION%.crx" "pack\out\my-tab-search-v%VERSION%-chrome.crx" >nul
echo [OK] Chrome package ready: my-tab-search-v%VERSION%-chrome.zip

REM ===================== EDGE ======================
echo.
echo ========== [2/2] EDGE package ==========
echo Syncing version...
call npm run sync-version
if %ERRORLEVEL% NEQ 0 echo [WARN] sync-version failed, continuing...

echo Building (prod)...
call npm run build
if %ERRORLEVEL% NEQ 0 goto :fail

echo Applying Edge manifest...
copy /Y manifest.edge.json pack\out\build\manifest.json >nul
if %ERRORLEVEL% NEQ 0 goto :fail

echo Packaging (skip compress)...
call npm run package -- --skip-compress
if %ERRORLEVEL% NEQ 0 goto :fail

if not exist "pack\out\my-tab-search-v%VERSION%.zip" (
    echo [ERROR] Edge ZIP not found after packaging
    goto :fail
)
if exist "pack\out\my-tab-search-v%VERSION%.zip" move /Y "pack\out\my-tab-search-v%VERSION%.zip" "pack\out\my-tab-search-v%VERSION%-edge.zip" >nul
if exist "pack\out\my-tab-search-v%VERSION%.crx" move /Y "pack\out\my-tab-search-v%VERSION%.crx" "pack\out\my-tab-search-v%VERSION%-edge.crx" >nul
echo [OK] Edge package ready: my-tab-search-v%VERSION%-edge.zip

REM ===================== DONE ======================
echo.
echo ============================================================
echo  DONE - two store packages ready in pack\out:
echo    my-tab-search-v%VERSION%-chrome.zip   (Chrome Web Store)
echo    my-tab-search-v%VERSION%-edge.zip     (Edge Add-ons)
echo ============================================================
echo.
echo Note: pack\out\build now holds the Edge prod manifest (no key).
echo       For local testing reload, rebuild with:
echo         node build.config.js --env=preprod --keep-key
echo.
if /i "%~1"=="--no-pause" exit /b 0
pause
exit /b 0

:fail
echo.
echo [FAILED] Packaging aborted. Please check the errors above.
if /i "%~1"=="--no-pause" exit /b 1
pause
exit /b 1
