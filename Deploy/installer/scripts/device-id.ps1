# Prints this computer's Vrodux Device ID - the same value as `Softaxis.ApiGateway.exe --device-id`
# (salted SHA-256 of the Windows MachineGuid, first 16 hex, XXXX-XXXX-XXXX-XXXX). Used by the
# setup wizard to show the ID before anything is installed.
param([string] $OutFile = "")
try {
    $key = [Microsoft.Win32.RegistryKey]::OpenBaseKey('LocalMachine', 'Registry64').OpenSubKey('SOFTWARE\Microsoft\Cryptography')
    $g = $key.GetValue('MachineGuid')
    $h = [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash(
            [Text.Encoding]::UTF8.GetBytes("vrodux-machine:" + $g.Trim().ToLower()))).Replace('-', '').Substring(0, 16)
    $id = "{0}-{1}-{2}-{3}" -f $h.Substring(0,4), $h.Substring(4,4), $h.Substring(8,4), $h.Substring(12,4)
} catch { $id = "UNKNOWN" }
if ($OutFile) { Set-Content -Path $OutFile -Value $id -Encoding ASCII } else { $id }
