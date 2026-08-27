using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyFinder;

/// <summary>
/// Resolves the Property Finder API credentials <b>for the calling tenant</b>.
///
/// <para>Credentials belong to a Property Finder ACCOUNT, and an account belongs to one agency. They
/// are therefore stored encrypted on that tenant's own <c>Integration</c> row — never in shared
/// configuration. A configuration-level key would be read by every tenant on the deployment, so one
/// agency's import would pull another agency's agents and enquiries into their CRM. There is no
/// fallback to configuration for exactly that reason.</para>
///
/// <para>The integration is found through <c>CrmDbContext</c>, whose global query filter is already
/// tenant-scoped, so a caller can only ever reach their own row.</para>
/// </summary>
public sealed class PropertyFinderCredentialStore(CrmDbContext db, ISecretProtector protector)
{
    public const string ProviderKey = "property-finder";

    /// <summary>The tenant's Property Finder integration, or null when it has not been connected.</summary>
    public Task<Integration?> FindIntegrationAsync(CancellationToken ct) =>
        db.Integrations.FirstOrDefaultAsync(i => i.ProviderKey == ProviderKey && !i.IsDeleted, ct);

    /// <summary>
    /// Decrypts the credentials stored on an integration. Null when none have been entered yet —
    /// which is a normal state, not an error: connecting the integration and entering the key are
    /// two separate steps.
    /// </summary>
    public PropertyFinderApiClient.Credentials? Read(Integration? integration)
    {
        if (integration?.Credentials is not { Length: > 0 } encrypted) return null;

        try
        {
            var json = protector.Unprotect(encrypted);
            var root = JsonDocument.Parse(json).RootElement;
            var key    = root.TryGetProperty("apiKey", out var k) ? k.GetString() : null;
            var secret = root.TryGetProperty("apiSecret", out var s) ? s.GetString() : null;

            return string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(secret)
                ? null
                : new PropertyFinderApiClient.Credentials(key.Trim(), secret.Trim());
        }
        catch
        {
            // Unreadable ciphertext usually means the Data Protection key ring was replaced. Treat
            // it as "not configured" so the caller asks for the key again, rather than throwing.
            return null;
        }
    }

    /// <summary>Resolves this tenant's credentials in one step.</summary>
    public async Task<PropertyFinderApiClient.Credentials?> ResolveAsync(CancellationToken ct) =>
        Read(await FindIntegrationAsync(ct));

    /// <summary>Encrypts and stores the key pair on the tenant's integration.</summary>
    public void Write(Integration integration, string apiKey, string apiSecret)
    {
        var json = JsonSerializer.Serialize(new { apiKey = apiKey.Trim(), apiSecret = apiSecret.Trim() });
        integration.SetCredentials(protector.Protect(json));
    }
}
