@echo off
REM ============================================================================
REM  Open firewall port 5000 for Vrodux ERP
REM  Run as Administrator — needed so other PCs on the network can connect
REM ============================================================================

net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] This script must be run as Administrator!
    echo.
    pause
    exit /b 1
)

echo.
echo  Adding firewall rule for Vrodux ERP (port 5000)...

netsh advfirewall firewall add rule ^
  name="Vrodux ERP Server" ^
  dir=in ^
  action=allow ^
  protocol=TCP ^
  localport=5000 ^
  profile=domain,private

if %ERRORLEVEL% EQU 0 (
    echo.
    echo  Firewall rule added. Other PCs on the network can now
    echo  connect to this server on port 5000.
) else (
    echo.
    echo  [ERROR] Failed to add firewall rule.
)

echo.
pause
