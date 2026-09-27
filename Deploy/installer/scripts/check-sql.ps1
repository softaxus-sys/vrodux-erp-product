# Can the person running setup reach this SQL Server instance with Windows authentication?
# Exit 0 = yes. Otherwise the reason is written to -OutFile for the wizard to show.
param([Parameter(Mandatory)] [string] $SqlServer, [string] $OutFile = "")
try {
    $c = New-Object System.Data.SqlClient.SqlConnection("Server=$SqlServer;Database=master;Integrated Security=true;TrustServerCertificate=True;Connect Timeout=10")
    $c.Open()
    $cmd = $c.CreateCommand(); $cmd.CommandText = "SELECT IS_SRVROLEMEMBER('sysadmin')"
    $isAdmin = $cmd.ExecuteScalar(); $c.Close()
    if ($isAdmin -ne 1) {
        if ($OutFile) { Set-Content $OutFile "Connected, but your Windows account is not a sysadmin on $SqlServer, so setup cannot create the database or grant the service access." }
        exit 2
    }
    exit 0
} catch {
    if ($OutFile) { Set-Content $OutFile $_.Exception.Message }
    exit 1
}
