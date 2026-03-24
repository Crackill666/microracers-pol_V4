@echo off
title MicroRacers POL - Admin Dashboard

echo =========================================
echo   MicroRacers POL - Admin Dashboard
echo =========================================
echo.

REM Ir a la carpeta donde está este .bat (scripts)
cd /d "%~dp0"

REM Subir a la raíz del proyecto (..)
cd ..

REM Verificación rápida
if not exist hardhat.config.js (
    echo ❌ No encuentro hardhat.config.js en: %CD%
    echo Este .bat debe estar en: C:\microracers_v4\scripts\
    pause
    exit /b
)

echo ▶ Ejecutando Admin Dashboard desde: %CD%
echo.

npx hardhat run scripts/admin-dashboard.js --network amoy

echo.
echo =========================================
echo   Dashboard finalizado
echo =========================================
pause
