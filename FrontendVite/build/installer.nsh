; ─────────────────────────────────────────────────────────────────────────────
;  Vrodux ERP desktop client — "Server address" wizard page
;
;  A workstation has to be told where the server is. Without this the client falls back to
;  http://localhost:5000, which is only ever right on the machine that also runs the server — so
;  every till and back-office PC installed without it looked installed but could reach nothing.
;
;  The address is written to  $INSTDIR\resources\server-config.json  and read by electron/main.cjs
;  as the DEFAULT. It is deliberately not a per-user file: a till is typically installed by an
;  administrator and then used by a cashier, so a per-user setting would be saved for the wrong
;  account. The tray's Server Settings dialog still overrides it, so a server that moves later does
;  not need a reinstall.
;
;  Silent installs (/S) skip the page — the combined server+client installer runs this with /S on
;  the server box itself, where localhost is correct. For unattended rollout to workstations pass
;  the address explicitly:
;
;      VroduxERP-Client-Setup.exe /S /SERVERURL=http://192.168.1.10:5000
;
;  NOTE: electron-builder's NSIS template does NOT use Modern UI, so MUI_* macros are unavailable
;  here — the page heading is drawn as a bold label rather than via MUI_HEADER_TEXT.
; ─────────────────────────────────────────────────────────────────────────────

; electron-builder includes this file BEFORE its own template pulls in the standard headers, so
; the Functions below would otherwise fail to parse with: Invalid command: "${If}".
; Both carry their own include guards, so requesting them again is harmless.
!include LogicLib.nsh
!include nsDialogs.nsh

Var ServerUrlValue

!macro preInit
  ; Default shown in the field, and the value used when the page is skipped.
  StrCpy $ServerUrlValue "http://localhost:5000"

  ; /SERVERURL=... for scripted deployment. Parsed before the page so it also prefills the field
  ; when the installer is run interactively with the switch.
  ${GetParameters} $R0
  ${GetOptions} $R0 "/SERVERURL=" $R1
  ${IfNot} ${Errors}
    StrCpy $ServerUrlValue $R1
  ${EndIf}
!macroend

!macro customPageAfterChangeDir
  ; A silent install has no wizard to show; the default (or /SERVERURL) stands.
  Page custom ServerUrlPageShow ServerUrlPageLeave
!macroend

; The uninstaller is compiled in a SEPARATE makensis pass in which assistedInstaller.nsh — and so
; the customPageAfterChangeDir hook — is skipped. Defining these Functions there too would leave
; them unreferenced, and electron-builder escalates NSIS's "not referenced - zeroing code out"
; warning to a build failure. customUnInstall below stays outside the guard: that one IS used there.
!ifndef BUILD_UNINSTALLER

; Control handles — only meaningful while the wizard page exists.
Var ServerUrlInput
Var ServerTestButton
Var ServerStatusLabel

Function ServerUrlPageShow
  ${If} ${Silent}
    Abort   ; skip the page entirely
  ${EndIf}

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 12u "Server address"
  Pop $1

  ${NSD_CreateLabel} 0 16u 100% 24u "Enter the address of the Vrodux ERP server on your network, including the port.$\r$\nFor example:  http://192.168.1.10:5000"
  Pop $2

  ${NSD_CreateText} 0 44u 100% 13u "$ServerUrlValue"
  Pop $ServerUrlInput

  ${NSD_CreateButton} 0 62u 60u 14u "Test"
  Pop $ServerTestButton
  ${NSD_OnClick} $ServerTestButton ServerUrlTest

  ${NSD_CreateLabel} 66u 64u 60% 12u ""
  Pop $ServerStatusLabel

  ${NSD_CreateLabel} 0 84u 100% 32u "You can change this later from the Vrodux ERP tray icon (Server Settings).$\r$\nIf the server runs on this same computer, leave the default."
  Pop $3

  nsDialogs::Show
FunctionEnd

; Ask the server's own health endpoint whether it is really there. Uses PowerShell rather than an
; NSIS HTTP plugin so the installer has no extra dependency. A failure never blocks the install —
; a site may install the client before the server is up — it only warns.
Function ServerUrlTest
  Pop $0
  ${NSD_GetText} $ServerUrlInput $ServerUrlValue
  ${NSD_SetText} $ServerStatusLabel "Checking..."

  nsExec::ExecToStack 'powershell -NoProfile -ExecutionPolicy Bypass -Command "try { if ((Invoke-WebRequest -Uri ''$ServerUrlValue/health'' -TimeoutSec 5 -UseBasicParsing).StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"'
  Pop $0
  Pop $1

  ${If} $0 == 0
    ${NSD_SetText} $ServerStatusLabel "Server responded - connection OK."
  ${Else}
    ${NSD_SetText} $ServerStatusLabel "No response. Check the address, or continue and set it later."
  ${EndIf}
FunctionEnd

Function ServerUrlPageLeave
  ${NSD_GetText} $ServerUrlInput $ServerUrlValue

  ; Trim a trailing slash so the app never builds "http://host:5000//api/hr".
  StrCpy $0 $ServerUrlValue "" -1
  ${If} $0 == "/"
    StrCpy $ServerUrlValue $ServerUrlValue -1
  ${EndIf}

  ${If} $ServerUrlValue == ""
    MessageBox MB_ICONEXCLAMATION "Please enter the server address."
    Abort
  ${EndIf}

  ; Require a scheme — "192.168.1.10:5000" alone is not a URL the app can call, and it is the single
  ; most likely thing to be typed.
  StrCpy $0 $ServerUrlValue 7
  StrCpy $1 $ServerUrlValue 8
  ${If} $0 != "http://"
  ${AndIf} $1 != "https://"
    MessageBox MB_ICONEXCLAMATION "The address must start with http:// or https://$\r$\n$\r$\nFor example:  http://192.168.1.10:5000"
    Abort
  ${EndIf}
FunctionEnd

!endif  ; BUILD_UNINSTALLER

!macro customInstall
  ; $INSTDIR\resources is where a packaged Electron app's process.resourcesPath points.
  CreateDirectory "$INSTDIR\resources"
  FileOpen $0 "$INSTDIR\resources\server-config.json" w
  FileWrite $0 '{$\r$\n  "apiUrl": "$ServerUrlValue"$\r$\n}$\r$\n'
  FileClose $0
!macroend

!macro customUnInstall
  Delete "$INSTDIR\resources\server-config.json"
!macroend
