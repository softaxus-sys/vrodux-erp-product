@echo off
REM ============================================================================
REM  Vrodux ERP Server — Install as Windows Service
REM  Run this as Administrator on the customer's server
REM ============================================================================

net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] This script must be run as Administrator!
    echo  Right-click and select "Run as administrator".
    echo.
    pause
    exit /b 1
)

set SERVICE_NAME=VroduxERP
set DISPLAY_NAME=Vrodux ERP Server
set EXE_PATH=%~dp0output\Softaxis.ApiGateway.exe

if not exist "%EXE_PATH%" (
    echo.
    echo  [ERROR] Server executable not found at:
    echo  %EXE_PATH%
    echo.
    echo  Run publish.bat first to build the server.
    echo.
    pause
    exit /b 1
)

echo.
echo  Installing %DISPLAY_NAME%...
echo  Executable: %EXE_PATH%
echo.

REM Stop and remove existing service if present
sc query %SERVICE_NAME% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo  Stopping existing service...
    sc stop %SERVICE_NAME% >nul 2>&1
    timeout /t 3 /nobreak >nul
    echo  Removing existing service...
    sc delete %SERVICE_NAME%
    timeout /t 2 /nobreak >nul
)

REM Create the service
sc create %SERVICE_NAME% ^
  binPath= "\"%EXE_PATH%\"" ^
  DisplayName= "%DISPLAY_NAME%" ^
  start= auto ^
  obj= "LocalSystem"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] Failed to create service!
    pause
    exit /b 1
)

REM Set description
sc description %SERVICE_NAME% "Vrodux ERP API Server — serves all ERP modules (Identity, HR, Finance, Inventory, Sales, Purchase, POS, CRM, etc.)"

REM Set recovery: restart on first, second, and subsequent failures
sc failure %SERVICE_NAME% reset= 86400 actions= restart/5000/restart/10000/restart/30000

REM Start the service
echo  Starting service...
sc start %SERVICE_NAME%

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [WARNING] Service created but failed to start.
    echo  Check Windows Event Viewer for details.
    echo  Common issue: appsettings.json connection string needs updating.
    echo.
    pause
    exit /b 1
)

echo.
echo  ============================================
echo   Vrodux ERP Server installed successfully!
echo.
echo   Service name:  %SERVICE_NAME%
echo   Status:        Running
echo   Startup type:  Automatic
echo   API URL:       http://localhost:5000
echo.
echo   Next steps:
echo   1. Update appsettings.json with the correct
echo      SQL Server connection string
echo   2. Open firewall port 5000 if employees
echo      connect from other machines
echo   3. Install VroduxERP-Setup.exe on each PC
echo      and point it to this server's IP
echo  ============================================
echo.
pause
