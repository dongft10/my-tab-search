@echo off

echo ========================================
echo   MyTabSearch Extension Repack
echo ========================================
echo.

cd /d "%~dp0.."

echo Building extension...
call npm run build-dev

if %ERRORLEVEL% equ 0 (
    echo.
    echo Build successful!
    echo Output: pack\out\my-tab-search-v2.0.0.crx
    echo.
    echo Please remove old extension in Chrome, then drag in new .crx file
) else (
    echo.
    echo Build failed!
)

echo.
pause
