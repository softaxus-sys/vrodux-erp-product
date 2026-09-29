@echo off
REM ============================================================================
REM  Build the single Vrodux ERP on-premises installer:
REM    Deploy\installer\Output\VroduxERP-<version>.exe
REM
REM  Steps: 1) publish the server  2) build the desktop app  3) compile VroduxERP.iss
REM  Options:
REM    build-installer.bat            full build
REM    build-installer.bat skipbuild  only re-compile the installer from existing builds
REM ============================================================================
setlocal
set ROOT=%~dp0..\..
set ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe
if not exist "%ISCC%" set ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe
if not exist "%ISCC%" (
    echo  [ERROR] Inno Setup not found. Install it once:  winget install JRSoftware.InnoSetup
    exit /b 1
)

REM Version comes from the desktop app's package.json
for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content '%ROOT%\FrontendVite\package.json' -Raw | ConvertFrom-Json).version"`) do set APPVER=%%V
echo  Building Vrodux ERP installer v%APPVER%

if /i "%1"=="skipbuild" goto compile

echo.
echo  [1/3] Publishing the server...
pushd "%ROOT%\Backend\src\ApiGateway\Softaxis.ApiGateway"
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o "%ROOT%\Deploy\server\output"
if %ERRORLEVEL% NEQ 0 ( popd & echo  [ERROR] Server publish failed. & exit /b 1 )
popd

echo.
echo  [2/3] Building the desktop app...
pushd "%ROOT%\FrontendVite"
call npm run electron:build-win
if %ERRORLEVEL% NEQ 0 ( popd & echo  [ERROR] Desktop app build failed. & exit /b 1 )
popd

:compile
echo.
echo  [3/3] Compiling the installer...
if not exist "%~dp0payload" mkdir "%~dp0payload"
copy /y "%ROOT%\FrontendVite\release\VroduxERP-Setup-%APPVER%.exe" "%~dp0payload\VroduxERP-Client-Setup.exe" >nul
if %ERRORLEVEL% NEQ 0 ( echo  [ERROR] Desktop app setup VroduxERP-Setup-%APPVER%.exe not found in FrontendVite\release. & exit /b 1 )

"%ISCC%" /DAppVersion=%APPVER% "%~dp0VroduxERP.iss"
if %ERRORLEVEL% NEQ 0 ( echo  [ERROR] Installer compile failed. & exit /b 1 )

REM Release layout: everything to hand out in one place - copy this folder to the site.
REM   Deploy\VroduxErpSoftware\VroduxERP-<ver>.exe                    main installation (server + app)
REM   Deploy\VroduxErpSoftware\Client\VroduxERP-Client-Setup-<ver>.exe  other tills (desktop app only)
set RELEASE=%ROOT%\Deploy\VroduxErpSoftware
if not exist "%RELEASE%\Client" mkdir "%RELEASE%\Client"
copy /y "%ROOT%\FrontendVite\release\VroduxERP-Setup-%APPVER%.exe" "%RELEASE%\Client\VroduxERP-Client-Setup-%APPVER%.exe" >nul

echo.
echo  ============================================
echo   Done: Deploy\VroduxErpSoftware\   (copy this folder to the site)
echo     VroduxERP-%APPVER%.exe                      main installation
echo     Client\VroduxERP-Client-Setup-%APPVER%.exe  other tills
echo  ============================================
endlocal
