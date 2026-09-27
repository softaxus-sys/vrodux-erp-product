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

REM ── 1. Service start timeout ────────────────────────────────────────────────
REM Vrodux runs every module's migrations before it tells Windows it has started. That can
REM take longer than Windows' default 30 seconds (fresh database, slower PC), and Windows then
REM kills the start with error 1053 although nothing is wrong. Allow 3 minutes.
REM The new value only applies after a reboot.
set NEED_REBOOT=0
set CUR_TIMEOUT=
for /f "tokens=3" %%A in ('reg query HKLM\SYSTEM\CurrentControlSet\Control /v ServicesPipeTimeout 2^>nul ^| find "ServicesPipeTimeout"') do set CUR_TIMEOUT=%%A
if /i not "%CUR_TIMEOUT%"=="0x2bf20" (
    echo  Setting Windows service start timeout to 3 minutes...
    reg add HKLM\SYSTEM\CurrentControlSet\Control /v ServicesPipeTimeout /t REG_DWORD /d 180000 /f >nul
    set NEED_REBOOT=1
) else (
    echo  Service start timeout already 3 minutes.
)
echo.

REM ── 2. Database access for the service account ──────────────────────────────
REM The service runs as LocalSystem. For Windows-authentication connection strings this creates
REM each database if missing and makes NT AUTHORITY\SYSTEM db_owner (see prepare-database.ps1).
echo  Preparing SQL Server database(s) from appsettings.json...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0prepare-database.ps1" -AppSettings "%~dp0output\appsettings.json"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] Database preparation failed - see the message above.
    echo  Fix appsettings.json / SQL Server, then run this script again.
    echo.
    pause
    exit /b 1
)
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
    if "%NEED_REBOOT%"=="1" (
        echo  [WARNING] Service created but did not start in time.
        echo  The 3-minute start timeout was just set and needs a RESTART of this computer.
        echo  After restarting, the service starts on its own - check with:  sc query %SERVICE_NAME%
    ) else (
        echo  [WARNING] Service created but failed to start.
        echo  Check Windows Event Viewer - Windows Logs - Application for the error.
        echo  Or run output\Softaxis.ApiGateway.exe from a console to see it directly.
    )
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
if "%NEED_REBOOT%"=="1" (
echo   NOTE: restart this computer once so the new
echo         3-minute service start timeout applies.
echo.
)
echo   Next steps:
echo   1. Check appsettings.json connection strings
echo      point at this site's SQL Server
echo   2. Set FrontendUrl in appsettings.json to the
echo      address staff open in their browser. Password
echo      reset and invite emails link to it - the
echo      default (localhost:5173) will not work.
echo   3. Open firewall port 5000 if employees
echo      connect from other machines
echo   4. Install VroduxERP-Setup.exe on each PC
echo      and point it to this server's IP
echo  ============================================
echo.
pause
