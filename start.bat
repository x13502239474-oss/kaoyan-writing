@echo off
cd /d "%~dp0"
echo.
echo   Kaoyan Writing Self-Study Site
echo   Starting local server... Keep this window open.
echo.
node server.js
echo.
echo   Server stopped. Press any key to close.
pause >nul
