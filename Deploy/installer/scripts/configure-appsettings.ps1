<#
  Writes the site's settings into the server's appsettings.json. Called by the VroduxERP setup
  wizard after the files are copied. Only the keys the wizard owns are changed; everything else
  in the file (Serilog, printer, email...) is left exactly as shipped.

  Values come from a UTF-8 "Key=Value" file (-ValuesFile) rather than the command line: wizard
  input can contain quotes, spaces or symbols (passwords especially) that break PowerShell's
  command-line parsing. The installer deletes the file straight after.
  Errors are appended to -LogFile so a failed install can be diagnosed.
#>
param(
    [Parameter(Mandatory)] [string] $Path,
    [Parameter(Mandatory)] [string] $ValuesFile,
    [string] $LogFile = ""
)
$ErrorActionPreference = 'Stop'

function Log([string]$msg) {
    if ($LogFile) { Add-Content -Path $LogFile -Value ("{0:yyyy-MM-dd HH:mm:ss} [configure] {1}" -f (Get-Date), $msg) -Encoding UTF8 }
}

function Set-Prop($obj, [string]$name, $value) {
    if ($obj.PSObject.Properties[$name]) { $obj.$name = $value }
    else { $obj | Add-Member -NotePropertyName $name -NotePropertyValue $value }
}

try {
    $v = @{}
    foreach ($line in [IO.File]::ReadAllLines($ValuesFile, [Text.Encoding]::UTF8)) {
        $i = $line.IndexOf('=')
        if ($i -gt 0) { $v[$line.Substring(0, $i).Trim()] = $line.Substring($i + 1) }
    }
    foreach ($req in 'SqlServer', 'Database', 'TenantName', 'AdminEmail') {
        if (-not $v[$req] -or -not $v[$req].Trim()) { throw "Missing value: $req" }
    }

    $json = Get-Content $Path -Raw -Encoding UTF8 | ConvertFrom-Json

    # Every module's connection string points at the one site database, Windows authentication
    # (the service runs as LocalSystem; prepare-database.ps1 grants it access).
    $cs = "Server=$($v.SqlServer.Trim());Database=$($v.Database.Trim());Integrated Security=true;MultipleActiveResultSets=true;TrustServerCertificate=True;"
    foreach ($p in @($json.ConnectionStrings.PSObject.Properties)) { $json.ConnectionStrings.($p.Name) = $cs }

    # A per-site JWT secret, generated only while the shipped placeholder is still there - so
    # re-running setup never logs everyone out by rotating it.
    if (-not $json.Jwt.Secret -or $json.Jwt.Secret -like '__SET_*') {
        $bytes = New-Object byte[] 64
        [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
        $json.Jwt.Secret = [Convert]::ToBase64String($bytes)
    }

    # Listen on every network interface, not just loopback.
    #
    # With no "Urls" here, Kestrel falls back to its built-in default of http://localhost:5000,
    # which binds ONLY 127.0.0.1 — so the server answers on the machine it runs on and is
    # unreachable from every till and workstation on the LAN. The symptom is confusing because
    # ping still replies (ICMP is handled by the OS) and the installer has already opened TCP 5000
    # in the firewall, so the port looks open while nothing is actually listening on the LAN
    # address. A client-side "cannot connect" is the only visible effect.
    $port = if ($v.ServerPort) { $v.ServerPort.Trim() } else { '5000' }
    Set-Prop $json 'Urls' "http://0.0.0.0:$port"

    if ($v.FrontendUrl) { Set-Prop $json 'FrontendUrl' $v.FrontendUrl.Trim() }

    $op = $json.OnPremises
    Set-Prop $op 'TenantName'     $v.TenantName.Trim()
    Set-Prop $op 'ContactEmail'   $v.AdminEmail.Trim()
    Set-Prop $op 'AdminEmail'     $v.AdminEmail.Trim()
    Set-Prop $op 'AdminUsername'  $v.AdminEmail.Trim()
    foreach ($k in 'Country', 'Industry', 'AdminFirstName', 'AdminLastName') {
        if ($v[$k]) { Set-Prop $op $k $v[$k].Trim() }
    }
    if ($v.Currency)      { Set-Prop $op 'Currency' $v.Currency.Trim().ToUpperInvariant() }
    if ($v.AdminPassword) { Set-Prop $op 'AdminPassword' $v.AdminPassword }
    if ($v.LicenseKey)    { Set-Prop $op 'LicenseKey' ($v.LicenseKey -replace '\s', '') }

    $out = $json | ConvertTo-Json -Depth 32
    [IO.File]::WriteAllText($Path, $out, (New-Object Text.UTF8Encoding($false)))
    Log "appsettings.json configured for '$($v.TenantName.Trim())' on $($v.SqlServer.Trim()) / $($v.Database.Trim())"
    exit 0
} catch {
    Log "FAILED: $($_.Exception.Message)"
    Write-Error $_.Exception.Message
    exit 1
}
