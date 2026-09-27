<#
  Vrodux ERP Server - prepare the SQL Server database(s) for the Windows service.
  Called by install-service.bat (run as Administrator). Safe to re-run.

  The service runs as LocalSystem, so connection strings that use Windows authentication
  (Integrated Security / Trusted_Connection) open the database as NT AUTHORITY\SYSTEM - an
  account that has no user in the database and cannot create one. Without this step the exe
  works from a console (running as you) but the service dies with 1053:
    - "Cannot open database"            -> SYSTEM has no user in the database
    - "CREATE DATABASE permission denied" -> the database does not exist yet

  For every distinct server + database in appsettings.json that uses Windows authentication,
  this script (running as the logged-in administrator):
    1. creates the database if it does not exist, and
    2. gives NT AUTHORITY\SYSTEM a user in it with db_owner (needed: the service creates and
       alters tables on every upgrade).
  Connection strings that use a SQL login are skipped - that login's rights are yours to manage.
#>
param([Parameter(Mandatory)] [string] $AppSettings, [string] $LogFile = "")

function Log([string]$msg) {
    if ($LogFile) { Add-Content -Path $LogFile -Value ("{0:yyyy-MM-dd HH:mm:ss} [database] {1}" -f (Get-Date), $msg) -Encoding UTF8 }
}

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $AppSettings)) {
    Write-Host "  [ERROR] appsettings.json not found: $AppSettings" -ForegroundColor Red
    exit 1
}

try {
    $json = Get-Content $AppSettings -Raw | ConvertFrom-Json
} catch {
    Write-Host "  [ERROR] appsettings.json is not valid JSON - fix it first: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$targets = @{}
foreach ($prop in $json.ConnectionStrings.PSObject.Properties) {
    # Pass the string to the constructor: in PowerShell, assigning $b.ConnectionString is treated
    # as a dictionary KEY named "ConnectionString" on this type, not as the property.
    try { $b = New-Object System.Data.SqlClient.SqlConnectionStringBuilder -ArgumentList $prop.Value } catch { continue }
    if (-not $b.IntegratedSecurity) { continue }                    # SQL login - not ours to grant
    if ([string]::IsNullOrWhiteSpace($b.InitialCatalog)) { continue }
    $targets["$($b.DataSource)|$($b.InitialCatalog)"] = @{ Server = $b.DataSource; Database = $b.InitialCatalog }
}

if ($targets.Count -eq 0) {
    Write-Host "  No Windows-authentication databases found - nothing to grant (SQL login in use?)."
    exit 0
}

$failed = $false
foreach ($t in $targets.Values) {
    $server = $t.Server; $db = $t.Database
    Write-Host "  Database [$db] on $server"
    try {
        $conn = New-Object System.Data.SqlClient.SqlConnection("Server=$server;Database=master;Integrated Security=true;TrustServerCertificate=True;Connect Timeout=15")
        $conn.Open()
        $cmd = $conn.CreateCommand()
        $dbq = $db.Replace(']', ']]')           # bracket-quote the name
        $dbs = $db.Replace("'", "''")           # string-quote the name
        $cmd.CommandText = @"
IF DB_ID(N'$dbs') IS NULL
BEGIN
    CREATE DATABASE [$dbq];
    PRINT 'created';
END
"@
        $null = $cmd.ExecuteNonQuery()

        $cmd.CommandText = @"
USE [$dbq];
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'NT AUTHORITY\SYSTEM')
    CREATE LOGIN [NT AUTHORITY\SYSTEM] FROM WINDOWS;
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'NT AUTHORITY\SYSTEM')
    CREATE USER [NT AUTHORITY\SYSTEM] FOR LOGIN [NT AUTHORITY\SYSTEM];
IF IS_ROLEMEMBER('db_owner', 'NT AUTHORITY\SYSTEM') <> 1
    ALTER ROLE db_owner ADD MEMBER [NT AUTHORITY\SYSTEM];
SELECT IS_ROLEMEMBER('db_owner', 'NT AUTHORITY\SYSTEM');
"@
        $ok = $cmd.ExecuteScalar()
        $conn.Close()
        if ($ok -eq 1) {
            Write-Host "    OK - exists, NT AUTHORITY\SYSTEM is db_owner" -ForegroundColor Green
            Log "[$db] on $server - OK, NT AUTHORITY\SYSTEM is db_owner"
        } else {
            Write-Host "    [ERROR] could not confirm db_owner for NT AUTHORITY\SYSTEM" -ForegroundColor Red
            $failed = $true
        }
    } catch {
        Write-Host "    [ERROR] $($_.Exception.Message)" -ForegroundColor Red
        Log "[$db] on $server - FAILED: $($_.Exception.Message)"
        Write-Host "    Check SQL Server is running and that YOU (the Windows admin) are a sysadmin on it." -ForegroundColor Yellow
        $failed = $true
    }
}

if ($failed) { exit 1 } else { exit 0 }
