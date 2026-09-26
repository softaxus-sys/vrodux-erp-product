using System.Security.Cryptography;
using System.Text;

namespace Softaxis.Identity.Infrastructure.Services;

/// <summary>
/// A stable, offline identifier for the machine this server runs on, used to bind an on-premises
/// license key to one installation.
///
/// Source: the OS installation id — <c>HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid</c> on
/// Windows, <c>/etc/machine-id</c> on Linux. Both survive reboots, app reinstalls and IP/hostname
/// changes, and are regenerated only by reinstalling the operating system — which is exactly when
/// a customer should ask for a new key. No network, no hardware probing.
///
/// Shown to the customer as <c>XXXX-XXXX-XXXX-XXXX</c>: a salted SHA-256 of the raw id, so the
/// code is safe to read out over the phone and reveals nothing about the machine.
/// </summary>
public static class MachineFingerprint
{
    private static readonly Lazy<string> Cached = new(Compute);

    /// <summary>This machine's code, or <c>"UNKNOWN"</c> when the OS id cannot be read.</summary>
    public static string Current => Cached.Value;

    /// <summary>Normalises a code typed by a person: upper-case, dashes and spaces ignored.</summary>
    public static string Normalize(string? code) =>
        new string((code ?? "").Where(char.IsLetterOrDigit).Select(char.ToUpperInvariant).ToArray());

    private static string Compute()
    {
        var raw = ReadOsId();
        if (string.IsNullOrWhiteSpace(raw)) return "UNKNOWN";

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes("vrodux-machine:" + raw.Trim().ToLowerInvariant()));
        var hex  = Convert.ToHexString(hash)[..16];
        return $"{hex[..4]}-{hex[4..8]}-{hex[8..12]}-{hex[12..16]}";
    }

    private static string? ReadOsId()
    {
        try
        {
            if (OperatingSystem.IsWindows())
            {
                using var key = Microsoft.Win32.RegistryKey
                    .OpenBaseKey(Microsoft.Win32.RegistryHive.LocalMachine, Microsoft.Win32.RegistryView.Registry64)
                    .OpenSubKey(@"SOFTWARE\Microsoft\Cryptography");
                return key?.GetValue("MachineGuid") as string;
            }

            foreach (var path in new[] { "/etc/machine-id", "/var/lib/dbus/machine-id" })
                if (File.Exists(path)) return File.ReadAllText(path);
        }
        catch
        {
            // Unreadable id → "UNKNOWN". A key bound to a machine will then refuse to run, which
            // is the safe direction; unbound keys are unaffected.
        }
        return null;
    }
}
