namespace Softaxis.Identity.Application.Abstractions;

public sealed record LicensePayload(
    Guid     TenantId,
    string   TenantSlug,
    string   Plan,
    int      MaxUsers,
    string[] Features,
    DateTime IssuedAt,
    DateTime ExpiresAt,
    // Optional machine binding. Null = the key runs on any machine (every key issued before this
    // field existed, and any key deliberately issued unbound). Set = the key runs only on the
    // machine whose code matches — checked offline, so it works for sites with no internet.
    string?  MachineId = null);

public interface ILicenseService
{
    /// <summary>Generate RSA-signed license key for on-prem tenant.</summary>
    string GenerateLicenseKey(LicensePayload payload);

    /// <summary>
    /// Validate a license key string (signature + expiry). Returns null on failure.
    /// Does NOT check the machine binding — the cloud calls this for keys belonging to other
    /// machines (heartbeat, sync). Code running ON the licensed installation must use
    /// <see cref="ValidateForThisMachine"/> instead.
    /// </summary>
    LicensePayload? ValidateLicenseKey(string licenseKey);

    /// <summary>
    /// <see cref="ValidateLicenseKey"/> plus the machine binding: a key bound to another machine
    /// returns null. For the on-premises installation checking its own key.
    /// </summary>
    LicensePayload? ValidateForThisMachine(string licenseKey);

    /// <summary>True when the key is signed and unexpired but bound to a different machine.</summary>
    bool IsBoundToAnotherMachine(string licenseKey);

    /// <summary>This machine's code (XXXX-XXXX-XXXX-XXXX), shown on the activation screen.</summary>
    string ThisMachineCode { get; }

    /// <summary>
    /// True when this server is configured as an on-premises install (an OnPremises section is
    /// filled in) — even before any key has been entered. Decides whether the machine code may be
    /// shown to anonymous visitors: an on-prem site needs it to obtain its first key, while the
    /// cloud server has no reason to publish its own.
    /// </summary>
    bool IsOnPremisesInstall { get; }
}
