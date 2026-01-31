@echo off
REM Chrome Extension Clean Script for Windows
REM This script cleans the build output directory

echo ========================================
echo Chrome Extension Clean Script
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

REM Clean build output
echo Cleaning build output directory...
call npm run clean
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Clean failed
    pause
    exit /b 1
)
echo [OK] Clean completed successfully
echo.

echo ========================================
echo Clean completed!
echo ========================================
echo.
echo The pack\out directory has been cleaned.
echo.
pause
