namespace Softaxis.Identity.Application.Abstractions;

public sealed record LicensePayload(
    Guid     TenantId,
    string   TenantSlug,
    string   Plan,
    int      MaxUsers,
    string[] Features,
    DateTime IssuedAt,
    DateTime ExpiresAt);

public interface ILicenseService
{
    /// <summary>Generate RSA-signed license key for on-prem tenant.</summary>
    string GenerateLicenseKey(LicensePayload payload);

    /// <summary>Validate a license key string. Returns null on failure.</summary>
    LicensePayload? ValidateLicenseKey(string licenseKey);
}
