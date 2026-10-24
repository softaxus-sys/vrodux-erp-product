# Stops the test gateway listening on a port (only processes run from a gwbranch folder - never the owner's own gateway).
param([Parameter(Mandatory)] [int] $Port)
Get-CimInstance Win32_Process -Filter "Name='Softaxis.ApiGateway.exe'" |
  Where-Object { $_.CommandLine -like '*gwbranch*' -or $_.ExecutablePath -like '*gwbranch*' } |
  ForEach-Object {
    $listen = Get-NetTCPConnection -OwningProcess $_.ProcessId -State Listen -ErrorAction SilentlyContinue | Where-Object LocalPort -eq $Port
    if ($listen) { Stop-Process -Id $_.ProcessId -Force; "stopped $($_.ProcessId) on :$Port" }
  }
