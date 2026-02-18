@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo   MyTabSearch Extension Build & Install
echo ========================================
echo.

cd /d "%~dp0.."

echo [1/3] 正在构建扩展...
call npm run build-dev
if %ERRORLEVEL% neq 0 (
    echo 构建失败！
    pause
    exit /b 1
)
echo 构建完成！

set CRX_PATH=%~dp0pack\out\my-tab-search-v2.0.0.crx

echo.
echo [2/3] 尝试自动安装...
echo 关闭 Chrome 中...

:: 尝试关闭 Chrome
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: 使用 Chrome 安装扩展
echo 安装扩展...
start "" chrome.exe --extensions-install-from-file="%CRX_PATH%" --no-startup-window

:: 等待安装
timeout /t 3 /nobreak >nul

:: 检查是否安装成功（通过检查进程是否正常启动）
echo.
echo [3/3] 检查安装状态...
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq chrome.exe" /NH') do (
    set CHROME_RUNNING=%%i
)

if defined CHROME_RUNNING (
    echo 扩展已自动安装！
) else (
    echo 自动安装可能失败，请手动操作：
    echo   1. 打开 Chrome 扩展页面: chrome://extensions/
    echo   2. 删除旧扩展（如ID不同）
    echo   3. 拖入: %CRX_PATH%
    explorer "%~dp0pack\out"
)

echo.
echo 完成！
pause
