@echo off
REM Test script to run pack_qa.bat

cd /d %~dp0

echo Running pack_qa.bat...
echo.

REM Run pack_qa.bat
call pack_qa.bat

REM Pause to see the output
pause