@echo off
REM ============================================================================
REM  Vrodux ERP Server — Publish as self-contained Windows executable
REM  Output: Deploy\server\output\  (single folder, no .NET runtime needed)
REM ============================================================================

echo.
echo  Publishing Vrodux ERP Server...
echo.

cd /d "%~dp0..\..\Backend\src\ApiGateway\Softaxis.ApiGateway"

dotnet publish -c Release -r win-x64 --self-contained true ^
  -p:PublishSingleFile=true ^
  -p:IncludeNativeLibrariesForSelfExtract=true ^
  -o "%~dp0output"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] Publish failed!
    pause
    exit /b 1
)

echo.
echo  ============================================
echo   Published to: Deploy\server\output\
echo   Copy this folder to the customer's server.
echo  ============================================
echo.
pause
