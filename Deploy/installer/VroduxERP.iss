; ============================================================================
;  Vrodux ERP — single on-premises installer (server + desktop app)
;  Build with build-installer.bat (publishes the server, builds the desktop
;  app, then compiles this script). Output: Deploy\installer\Output\VroduxERP-<ver>.exe
;
;  What it does on the store PC:
;    1. Wizard: SQL Server + database, store details, first administrator,
;       licence key (shows this PC's Device ID).
;    2. Copies the server to {app}\server and writes appsettings.json.
;    3. Allows Windows services 3 minutes to start (ServicesPipeTimeout).
;    4. Creates the database if missing; grants NT AUTHORITY\SYSTEM db_owner.
;    5. Opens TCP 5000 in the firewall, installs + starts the Windows service.
;    6. Installs the Vrodux ERP desktop app (points at localhost:5000).
;  Re-running on an installed PC upgrades in place and keeps appsettings.json.
; ============================================================================

#define AppName      "Vrodux ERP"
#ifndef AppVersion
  #define AppVersion "2.0.0"
#endif
#define ServiceName  "VroduxERP"
#define ServerPort   "5000"
#define ClientSetup  "VroduxERP-Client-Setup.exe"

[Setup]
AppId=VroduxERP-OnPremises-Server
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Softaxis Technologies
DefaultDirName={autopf}\Vrodux ERP
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=Output
OutputBaseFilename=VroduxERP-{#AppVersion}
SetupIconFile=..\..\FrontendVite\public\vrodux-icon.ico
UninstallDisplayIcon={app}\server\Softaxis.ApiGateway.exe
Compression=lzma2/max
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
WizardStyle=modern
CloseApplications=no
RestartIfNeededByRun=no

[Files]
; Server. appsettings.json is shipped separately so an upgrade never overwrites a site's config.
Source: "..\server\output\*"; DestDir: "{app}\server"; Excludes: "appsettings.json,appsettings.Development.json"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\server\output\appsettings.json"; DestDir: "{app}\server"; Flags: onlyifdoesntexist uninsneveruninstall
; Helper scripts
Source: "..\server\prepare-database.ps1"; DestDir: "{app}\tools"; Flags: ignoreversion
Source: "scripts\configure-appsettings.ps1"; DestDir: "{app}\tools"; Flags: ignoreversion
Source: "scripts\device-id.ps1"; DestDir: "{app}\tools"; Flags: ignoreversion
; Also needed during the wizard, before [Files] are installed
Source: "scripts\device-id.ps1"; Flags: dontcopy
Source: "scripts\check-sql.ps1"; Flags: dontcopy
Source: "scripts\check-license.ps1"; Flags: dontcopy
; Desktop app installer (NSIS, built by electron-builder)
Source: "payload\{#ClientSetup}"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Registry]
; Vrodux runs every module's migrations before telling Windows it has started; allow 3 minutes.
Root: HKLM; Subkey: "SYSTEM\CurrentControlSet\Control"; ValueType: dword; ValueName: "ServicesPipeTimeout"; ValueData: "180000"; Check: TimeoutNeedsSetting

[Icons]
Name: "{group}\Vrodux ERP Server status"; Filename: "http://localhost:{#ServerPort}/health"
Name: "{group}\Uninstall Vrodux ERP Server"; Filename: "{uninstallexe}"

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop {#ServiceName}"; Flags: runhidden waituntilterminated; RunOnceId: "StopSvc"
Filename: "{sys}\sc.exe"; Parameters: "delete {#ServiceName}"; Flags: runhidden waituntilterminated; RunOnceId: "DelSvc"
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Vrodux ERP Server"""; Flags: runhidden waituntilterminated; RunOnceId: "DelFw"

[Code]
var
  KeepPage: TInputOptionWizardPage;
  SqlPage, StorePage, AdminPage: TInputQueryWizardPage;
  LicensePage: TWizardPage;
  LicenseMemo: TNewMemo;
  DeviceIdEdit: TNewEdit;
  LicenseInfo: TNewStaticText;
  DeviceId: String;
  ExistingConfig: Boolean;
  TimeoutWasSet: Boolean;
  StepErrors: String;
  LogPath: String;

function PS(const Args: String): String;
begin
  Result := '-NoProfile -ExecutionPolicy Bypass ' + Args;
end;

function Q(S: String): String;
begin
  { quote for a PowerShell -File argument }
  StringChangeEx(S, '"', '\"', True);
  Result := '"' + S + '"';
end;

function Arg(const Name, Value: String): String;
begin
  { Windows PowerShell drops an empty "" argument after -File, which leaves the parameter
    without a value and aborts the script - so optional values are only passed when set. }
  if Trim(Value) = '' then Result := '' else Result := ' -' + Name + ' ' + Q(Value);
end;

function ReadFirstLine(const FileName: String): String;
var Lines: TArrayOfString;
begin
  Result := '';
  if LoadStringsFromFile(FileName, Lines) and (GetArrayLength(Lines) > 0) then
    Result := Trim(Lines[0]);
end;

function ReadAll(const FileName: String): String;
var Lines: TArrayOfString; i: Integer;
begin
  Result := '';
  if LoadStringsFromFile(FileName, Lines) then
    for i := 0 to GetArrayLength(Lines) - 1 do begin
      if Result <> '' then Result := Result + #13#10;
      Result := Result + Lines[i];
    end;
end;

function TimeoutNeedsSetting: Boolean;
var V: Cardinal;
begin
  Result := not (RegQueryDWordValue(HKLM64, 'SYSTEM\CurrentControlSet\Control', 'ServicesPipeTimeout', V) and (V >= 180000));
  if Result then TimeoutWasSet := True;
end;

procedure ComputeDeviceId;
var RC: Integer; OutF: String;
begin
  ExtractTemporaryFile('device-id.ps1');
  OutF := ExpandConstant('{tmp}\deviceid.txt');
  Exec('powershell.exe', PS('-File ' + Q(ExpandConstant('{tmp}\device-id.ps1')) + ' -OutFile ' + Q(OutF)),
       '', SW_HIDE, ewWaitUntilTerminated, RC);
  DeviceId := ReadFirstLine(OutF);
  if DeviceId = '' then DeviceId := 'UNKNOWN';
end;

procedure CopyDeviceIdClick(Sender: TObject);
var RC: Integer;
begin
  { Inno's edit control has no clipboard API; Windows' clip.exe does the job. }
  Exec(ExpandConstant('{cmd}'), '/C echo|set /p=' + DeviceId + '| clip', '', SW_HIDE, ewWaitUntilTerminated, RC);
  MsgBox('Device ID ' + DeviceId + ' copied.' + #13#10#13#10 +
         'Send it to Softaxis. When the licence key comes back, paste it into the box below - ' +
         'this window can stay open until then.', mbInformation, MB_OK);
end;

{ Installed SQL Server instances on this PC, from the registry SQL Server itself writes:
  HKLM\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL  (value name = instance).
  Returns the best default connection name (SQLEXPRESS preferred) and a readable list. }
function DetectSqlInstance(var AllFound: String): String;
var Names: TArrayOfString; i: Integer; Pc, N: String;
begin
  Result := ''; AllFound := '';
  Pc := GetComputerNameString;
  if RegGetValueNames(HKLM64, 'SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL', Names) then
    for i := 0 to GetArrayLength(Names) - 1 do begin
      if Uppercase(Names[i]) = 'MSSQLSERVER' then N := Pc          { default instance }
      else N := Pc + '\' + Names[i];
      if AllFound <> '' then AllFound := AllFound + ', ';
      AllFound := AllFound + N;
      if (Result = '') or (Uppercase(Names[i]) = 'SQLEXPRESS') then Result := N;
    end;
end;

procedure InitializeWizard;
var L: TNewStaticText; CopyBtn: TNewButton; SqlFound, SqlDefault: String;
begin
  ExistingConfig := FileExists(ExpandConstant('{autopf}\Vrodux ERP\server\appsettings.json'));
  ComputeDeviceId;

  KeepPage := CreateInputOptionPage(wpSelectDir, 'Existing installation',
    'Vrodux ERP is already configured on this computer.',
    'Keep the current settings (database, store, administrator, licence) and just upgrade the software?', True, False);
  KeepPage.Add('Upgrade and keep current settings (recommended)');
  KeepPage.Add('Reconfigure from scratch');
  KeepPage.SelectedValueIndex := 0;

  SqlDefault := DetectSqlInstance(SqlFound);
  if SqlFound <> '' then
    SqlFound := 'SQL Server found on this computer: ' + SqlFound + '.'
  else
    SqlFound := 'No SQL Server was found on this computer - install SQL Server Express first, or enter a server on the network.';
  SqlPage := CreateInputQueryPage(KeepPage.ID, 'Database',
    'Where should Vrodux ERP keep its data?',
    SqlFound + ' The database is created if it does not exist.');
  SqlPage.Add('SQL Server instance:', False);
  SqlPage.Add('Database name:', False);
  if SqlDefault <> '' then SqlPage.Values[0] := SqlDefault
  else SqlPage.Values[0] := GetComputerNameString + '\SQLEXPRESS';
  SqlPage.Values[1] := 'VroduxErpDb';

  StorePage := CreateInputQueryPage(SqlPage.ID, 'Store',
    'Details of the business using this installation.', '');
  StorePage.Add('Store / company name:', False);
  StorePage.Add('Country:', False);
  StorePage.Add('Currency (3-letter code, e.g. PKR, AED):', False);
  StorePage.Add('Industry:', False);
  StorePage.Values[1] := 'Pakistan';
  StorePage.Values[2] := 'PKR';
  StorePage.Values[3] := 'Retail';

  AdminPage := CreateInputQueryPage(StorePage.ID, 'Administrator',
    'The first user who will sign in.', 'They should change the password after the first sign-in.');
  AdminPage.Add('Email (also the username):', False);
  AdminPage.Add('First name:', False);
  AdminPage.Add('Last name:', False);
  AdminPage.Add('Temporary password (min 8 characters):', True);

  LicensePage := CreateCustomPage(AdminPage.ID, 'Licence',
    'Step 1: send this Device ID to Softaxis.  Step 2: paste the licence key you receive, then click Next.');
  L := TNewStaticText.Create(LicensePage);
  L.Parent := LicensePage.Surface;
  L.Caption := 'This computer''s Device ID - send it to Softaxis to get a licence key for this PC:';
  L.Top := 0; L.Width := LicensePage.SurfaceWidth;
  DeviceIdEdit := TNewEdit.Create(LicensePage);
  DeviceIdEdit.Parent := LicensePage.Surface;
  DeviceIdEdit.Top := L.Top + L.Height + ScaleY(4);
  DeviceIdEdit.Width := ScaleX(200);
  DeviceIdEdit.ReadOnly := True;
  DeviceIdEdit.Text := DeviceId;
  DeviceIdEdit.Font.Style := [fsBold];
  CopyBtn := TNewButton.Create(LicensePage);
  CopyBtn.Parent := LicensePage.Surface;
  CopyBtn.Caption := 'Copy';
  CopyBtn.Left := DeviceIdEdit.Left + DeviceIdEdit.Width + ScaleX(8);
  CopyBtn.Top := DeviceIdEdit.Top - ScaleY(1);
  CopyBtn.Width := ScaleX(75);
  CopyBtn.Height := DeviceIdEdit.Height + ScaleY(2);
  CopyBtn.OnClick := @CopyDeviceIdClick;
  L := TNewStaticText.Create(LicensePage);
  L.Parent := LicensePage.Surface;
  L.Caption := 'Licence key (paste the whole key):';
  L.Top := DeviceIdEdit.Top + DeviceIdEdit.Height + ScaleY(14); L.Width := LicensePage.SurfaceWidth;
  LicenseMemo := TNewMemo.Create(LicensePage);
  LicenseMemo.Parent := LicensePage.Surface;
  LicenseMemo.Top := L.Top + L.Height + ScaleY(4);
  LicenseMemo.Width := LicensePage.SurfaceWidth;
  LicenseMemo.Height := ScaleY(110);
  LicenseMemo.ScrollBars := ssVertical;
  LicenseMemo.WordWrap := True;
  LicenseInfo := TNewStaticText.Create(LicensePage);
  LicenseInfo.Parent := LicensePage.Surface;
  LicenseInfo.Top := LicenseMemo.Top + LicenseMemo.Height + ScaleY(8);
  LicenseInfo.Width := LicensePage.SurfaceWidth;
  LicenseInfo.AutoSize := False;
  LicenseInfo.Height := ScaleY(40);
  LicenseInfo.WordWrap := True;
  LicenseInfo.Caption := 'The key is checked before setup continues: it must be complete, not expired, and issued for this Device ID.';
end;

function Reconfigure: Boolean;
begin
  Result := (not ExistingConfig) or (KeepPage.SelectedValueIndex = 1);
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if PageID = KeepPage.ID then Result := not ExistingConfig
  else if (PageID = SqlPage.ID) or (PageID = StorePage.ID) or (PageID = AdminPage.ID) or (PageID = LicensePage.ID) then
    Result := not Reconfigure;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var RC: Integer; OutF, Msg: String;
begin
  Result := True;
  if CurPageID = SqlPage.ID then begin
    if (Trim(SqlPage.Values[0]) = '') or (Trim(SqlPage.Values[1]) = '') then begin
      MsgBox('Enter the SQL Server instance and a database name.', mbError, MB_OK); Result := False; Exit;
    end;
    ExtractTemporaryFile('check-sql.ps1');
    OutF := ExpandConstant('{tmp}\sqlcheck.txt');
    DeleteFile(OutF);
    WizardForm.NextButton.Enabled := False;
    Exec('powershell.exe', PS('-File ' + Q(ExpandConstant('{tmp}\check-sql.ps1')) + ' -SqlServer ' + Q(Trim(SqlPage.Values[0])) + ' -OutFile ' + Q(OutF)),
         '', SW_HIDE, ewWaitUntilTerminated, RC);
    WizardForm.NextButton.Enabled := True;
    if RC <> 0 then begin
      Msg := ReadFirstLine(OutF);
      MsgBox('Cannot use SQL Server "' + SqlPage.Values[0] + '":' + #13#10#13#10 + Msg + #13#10#13#10 +
             'Check that SQL Server is installed and running, and the instance name is correct.', mbError, MB_OK);
      Result := False;
    end;
  end
  else if CurPageID = StorePage.ID then begin
    if Trim(StorePage.Values[0]) = '' then begin
      MsgBox('Enter the store / company name.', mbError, MB_OK); Result := False;
    end;
  end
  else if CurPageID = LicensePage.ID then begin
    if Trim(LicenseMemo.Text) = '' then begin
      MsgBox('Paste the licence key before continuing.' + #13#10#13#10 +
             'Send the Device ID ' + DeviceId + ' to Softaxis to get one. This window can stay open until it arrives.',
             mbError, MB_OK);
      Result := False; Exit;
    end;
    ExtractTemporaryFile('check-license.ps1');
    SaveStringToFile(ExpandConstant('{tmp}\lickey.txt'), LicenseMemo.Text, False);
    OutF := ExpandConstant('{tmp}\licinfo.txt');
    DeleteFile(OutF);
    Exec('powershell.exe', PS('-File ' + Q(ExpandConstant('{tmp}\check-license.ps1')) +
         ' -KeyFile ' + Q(ExpandConstant('{tmp}\lickey.txt')) + ' -DeviceId ' + Q(DeviceId) + ' -OutFile ' + Q(OutF)),
         '', SW_HIDE, ewWaitUntilTerminated, RC);
    Msg := ReadAll(OutF);
    if RC <> 0 then begin
      MsgBox(Msg, mbError, MB_OK);
      Result := False;
    end else
      LicenseInfo.Caption := Msg;
  end
  else if CurPageID = AdminPage.ID then begin
    if (Pos('@', AdminPage.Values[0]) = 0) then begin
      MsgBox('Enter a valid administrator email.', mbError, MB_OK); Result := False;
    end else if Length(AdminPage.Values[3]) < 8 then begin
      MsgBox('The temporary password must be at least 8 characters.', mbError, MB_OK); Result := False;
    end;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var RC: Integer;
begin
  { An upgrade must stop the running service first, or its exe is locked. }
  Exec(ExpandConstant('{sys}\sc.exe'), 'stop {#ServiceName}', '', SW_HIDE, ewWaitUntilTerminated, RC);
  Sleep(4000);
  Result := '';
end;

procedure RunStep(const Title, FileName, Params: String);
var RC: Integer;
begin
  WizardForm.StatusLabel.Caption := Title;
  if not Exec(FileName, Params, '', SW_HIDE, ewWaitUntilTerminated, RC) or (RC <> 0) then
    StepErrors := StepErrors + #13#10 + '- ' + Title + ' (exit code ' + IntToStr(RC) + ')';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var Srv, Tools, Exe, Lic, ValuesFile: String; RC_Dummy: Integer;
begin
  if CurStep <> ssPostInstall then Exit;
  Srv   := ExpandConstant('{app}\server');
  Tools := ExpandConstant('{app}\tools');
  Exe   := Srv + '\Softaxis.ApiGateway.exe';
  LogPath := ExpandConstant('{app}\install.log');

  if Reconfigure then begin
    Lic := LicenseMemo.Text;
    StringChangeEx(Lic, #13, '', True); StringChangeEx(Lic, #10, '', True); StringChangeEx(Lic, ' ', '', True);
    { Wizard values go through a temp file, never the command line: passwords and names can
      contain quotes/symbols that break PowerShell argument parsing. Deleted right after. }
    ValuesFile := ExpandConstant('{tmp}\site-values.txt');
    SaveStringsToUTF8File(ValuesFile, [
      'SqlServer=' + Trim(SqlPage.Values[0]),
      'Database=' + Trim(SqlPage.Values[1]),
      'TenantName=' + Trim(StorePage.Values[0]),
      'Country=' + Trim(StorePage.Values[1]),
      'Currency=' + Trim(StorePage.Values[2]),
      'Industry=' + Trim(StorePage.Values[3]),
      'AdminEmail=' + Trim(AdminPage.Values[0]),
      'AdminFirstName=' + Trim(AdminPage.Values[1]),
      'AdminLastName=' + Trim(AdminPage.Values[2]),
      'AdminPassword=' + AdminPage.Values[3],
      'LicenseKey=' + Lic,
      'FrontendUrl=http://' + GetComputerNameString + ':{#ServerPort}'], False);
    RunStep('Writing configuration...', 'powershell.exe',
      PS('-File ' + Q(Tools + '\configure-appsettings.ps1') + ' -Path ' + Q(Srv + '\appsettings.json') +
         ' -ValuesFile ' + Q(ValuesFile) + ' -LogFile ' + Q(LogPath)));
    DeleteFile(ValuesFile);
  end;

  RunStep('Preparing the database...', 'powershell.exe',
    PS('-File ' + Q(Tools + '\prepare-database.ps1') + ' -AppSettings ' + Q(Srv + '\appsettings.json') + ' -LogFile ' + Q(LogPath)));

  RunStep('Opening firewall port {#ServerPort}...', ExpandConstant('{sys}\netsh.exe'),
    'advfirewall firewall delete rule name="Vrodux ERP Server"');
  RunStep('Opening firewall port {#ServerPort}...', ExpandConstant('{sys}\netsh.exe'),
    'advfirewall firewall add rule name="Vrodux ERP Server" dir=in action=allow protocol=TCP localport={#ServerPort}');

  { (Re)create the service so an upgrade always points at the current exe path. }
  Exec(ExpandConstant('{sys}\sc.exe'), 'delete {#ServiceName}', '', SW_HIDE, ewWaitUntilTerminated, RC_Dummy);
  Sleep(2000);
  RunStep('Installing the Windows service...', ExpandConstant('{sys}\sc.exe'),
    'create {#ServiceName} binPath= "\"' + Exe + '\"" DisplayName= "Vrodux ERP Server" start= auto obj= LocalSystem');
  Exec(ExpandConstant('{sys}\sc.exe'), 'description {#ServiceName} "Vrodux ERP API Server"', '', SW_HIDE, ewWaitUntilTerminated, RC_Dummy);
  Exec(ExpandConstant('{sys}\sc.exe'), 'failure {#ServiceName} reset= 86400 actions= restart/5000/restart/10000/restart/30000', '', SW_HIDE, ewWaitUntilTerminated, RC_Dummy);

  WizardForm.StatusLabel.Caption := 'Starting the Vrodux ERP service (first start can take a few minutes)...';
  if not TimeoutWasSet then
    RunStep('Starting the Windows service...', ExpandConstant('{sys}\sc.exe'), 'start {#ServiceName}')
  else
    Exec(ExpandConstant('{sys}\sc.exe'), 'start {#ServiceName}', '', SW_HIDE, ewWaitUntilTerminated, RC_Dummy);

  RunStep('Installing the Vrodux ERP desktop app...', ExpandConstant('{tmp}\{#ClientSetup}'), '/S');
end;

function NeedRestart: Boolean;
begin
  { The 3-minute service start timeout only applies after a reboot. }
  Result := TimeoutWasSet;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if (CurPageID = wpFinished) and (StepErrors <> '') then
    MsgBox('Vrodux ERP was installed, but some steps reported a problem:' + #13#10 + StepErrors + #13#10#13#10 +
           'Details are in ' + ExpandConstant('{app}\install.log') + #13#10 +
           'Fix the cause and run this setup again (choose "Reconfigure").', mbError, MB_OK);
end;
