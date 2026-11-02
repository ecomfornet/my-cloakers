@echo off
title CloakMaster Pro - Cloudflare Cloaker Dashboard
echo ======================================================
echo    Starting CloakMaster Pro Dashboard Server...
echo ======================================================
cd /d "%~dp0"
:: Free port 5050 and old ports if lingering
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5050 " 2^>nul') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " 2^>nul') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3847 " 2^>nul') do taskkill /F /PID %%a 2>nul
timeout /t 1 /nobreak >nul
start "" "http://localhost:5050"
node server.js
pause
