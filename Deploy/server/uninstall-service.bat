@echo off
REM ============================================================================
REM  Vrodux ERP Server — Uninstall Windows Service
REM  Run this as Administrator
REM ============================================================================

net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] This script must be run as Administrator!
    echo.
    pause
    exit /b 1
)

set SERVICE_NAME=VroduxERP

echo.
echo  Stopping Vrodux ERP Server...
sc stop %SERVICE_NAME% >nul 2>&1
timeout /t 3 /nobreak >nul

echo  Removing service...
sc delete %SERVICE_NAME%

if %ERRORLEVEL% EQU 0 (
    echo.
    echo  Service removed successfully.
) else (
    echo.
    echo  Service was not found or already removed.
)

echo.
pause
