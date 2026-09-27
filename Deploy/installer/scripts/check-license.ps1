<#
  Setup-wizard check of a pasted licence key, BEFORE anything is installed.
  Reads the key's payload (keys are signed, not encrypted) and checks it is complete, not expired,
  and issued for this computer. The RSA signature itself is verified by the server on every start,
  so a tampered key is still refused there - this is only here to catch mistakes early.
  Exit 0 = OK (details in -OutFile), non-zero = problem (reason in -OutFile).
#>
param([Parameter(Mandatory)] [string] $KeyFile, [Parameter(Mandatory)] [string] $DeviceId, [string] $OutFile = "")

function Done([int]$code, [string]$msg) { if ($OutFile) { Set-Content $OutFile $msg } ; exit $code }

$key = ((Get-Content $KeyFile -Raw) -replace '\s', '')
if (-not $key) { Done 1 "No licence key was entered." }
$parts = $key.Split('.')
if ($parts.Count -ne 2 -or $parts[1].Length -lt 100) { Done 1 "This does not look like a complete Vrodux licence key. Paste the whole key." }

try {
    $p = $parts[0].Replace('-', '+').Replace('_', '/')
    $p += '=' * ((4 - $p.Length % 4) % 4)
    $payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p)) | ConvertFrom-Json
} catch { Done 1 "This does not look like a valid Vrodux licence key. Paste the whole key." }

$expires = [DateTime]::Parse($payload.ExpiresAt, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AdjustToUniversal)
if ($expires -le [DateTime]::UtcNow) { Done 1 ("This licence key expired on {0:dd MMM yyyy}. Ask Softaxis for a new one." -f $expires) }

$norm = { param($s) (($s -replace '[^A-Za-z0-9]', '').ToUpperInvariant()) }
if ($payload.MachineId -and (& $norm $payload.MachineId) -ne (& $norm $DeviceId)) {
    Done 1 ("This licence key was issued for a different computer ({0}).`nThis computer's Device ID is {1} - ask Softaxis for a key for this ID." -f $payload.MachineId, $DeviceId)
}

$bound = if ($payload.MachineId) { "for this computer" } else { "for any computer (not machine-bound)" }
Done 0 ("Valid licence for '{0}' ({1} plan), {2}, until {3:dd MMM yyyy}." -f $payload.TenantSlug, $payload.Plan, $bound, $expires)
