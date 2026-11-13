@echo off
echo ========================================================
echo   Grand Arena - VPS Backup (Baza va Loyiha Nusxasi)
echo ========================================================
powershell -ExecutionPolicy Bypass -File "%~dp0backup_from_vps.ps1"
echo.
pause
