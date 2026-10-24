using System.Security.Cryptography;
using System.Text;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync.Branch;

/// <summary>
/// A stable, non-reversible identifier for this PC: a hash of the Windows machine GUID (falling back to the
/// machine name). It survives a reinstall of the software on the same PC, and differs on any other PC.
/// </summary>
public static class BranchMachineId
{
    public static string Current { get; } = Compute();

    private static string Compute()
    {
        string? id = null;
        try
        {
            if (OperatingSystem.IsWindows())
                id = Microsoft.Win32.Registry.GetValue(@"HKEY_LOCAL_MACHINESOFTWAREMicrosoftCryptography", "MachineGuid", null) as string;
        }
        catch { /* fall back below */ }
        id = string.IsNullOrWhiteSpace(id) ? Environment.MachineName : id;
        return "m1-" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("vrodux-branch|" + id)))[..32].ToLowerInvariant();
    }
}
