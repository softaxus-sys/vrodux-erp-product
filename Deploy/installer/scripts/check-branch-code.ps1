<#
  Checks a branch connection code (issued on head office: Settings -> Branch Servers -> Issue key)
  before setup continues: that it decodes, and that head office accepts the key.

  The code is "VBR1." + base64url of {u: head-office address, t: workspace id, b: branch id, k: key}.
  Writes a one-line result to -OutFile. Exit 0 = OK, 1 = the code is unusable, 2 = valid code but head
  office could not be reached (setup may continue - the branch connects once the internet is back).
#>
param(
    [Parameter(Mandatory)] [string] $CodeFile,
    [Parameter(Mandatory)] [string] $OutFile
)
$ErrorActionPreference = 'Stop'
function Done([int]$code, [string]$msg) { Set-Content -Path $OutFile -Value $msg -Encoding UTF8; exit $code }

try {
    $code = ([IO.File]::ReadAllText($CodeFile, [Text.Encoding]::UTF8)) -replace '\s', ''
    if (-not $code.StartsWith('VBR1.')) { Done 1 'This is not a branch connection code. It starts with VBR1. - copy it again from head office (Settings > Branch Servers).' }
    $b64 = $code.Substring(5).Replace('-', '+').Replace('_', '/')
    switch ($b64.Length % 4) { 2 { $b64 += '==' } 3 { $b64 += '=' } }
    $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64)) | ConvertFrom-Json
    foreach ($f in 'u', 't', 'b', 'k') { if (-not $json.$f) { Done 1 "The connection code is incomplete (missing '$f'). Copy it again." } }
    [guid]::Parse($json.t) | Out-Null; [guid]::Parse($json.b) | Out-Null
} catch {
    Done 1 "The connection code could not be read: $($_.Exception.Message). Copy the whole code again."
}

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $res = Invoke-WebRequest -Uri ($json.u.TrimEnd('/') + '/api/sync/branch/ping') -UseBasicParsing -TimeoutSec 15 `
        -Headers @{ 'X-Branch-Id' = "$($json.b)"; 'X-Branch-Key' = "$($json.k)" }
    Done 0 "Head office ($($json.u)) accepted this branch."
} catch {
    $status = $null
    if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
    if ($status -eq 401) { Done 1 'Head office rejected the key. It may have been revoked or replaced - issue a new one on head office.' }
    if ($status -eq 404) { Done 1 "The address $($json.u) is not a head-office server for branch servers." }
    Done 2 "Head office ($($json.u)) could not be reached: $($_.Exception.Message)"
}
