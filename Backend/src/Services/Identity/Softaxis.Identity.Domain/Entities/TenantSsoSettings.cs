namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// A workspace's own Microsoft Entra ID (Microsoft 365) app, used to let its staff sign in with their work
/// account. One row per tenant.
///
/// <para>Each workspace brings its OWN app registration (single-tenant), rather than every customer sharing
/// one multi-tenant app of ours. That is what an IT department expects, and it means one customer's
/// directory can never be trusted to vouch for a user in another's: the token must come from the directory
/// id stored here, for the client id stored here.</para>
///
/// <para>The client secret is stored encrypted and is write-only: nothing ever returns it.</para>
/// </summary>
public sealed class TenantSsoSettings
{
    private TenantSsoSettings() { }

    public TenantSsoSettings(Guid tenantId)
    {
        Id = Guid.NewGuid(); TenantId = tenantId; UpdatedAt = DateTime.UtcNow;
    }

    public Guid    Id                 { get; private set; }
    public Guid    TenantId           { get; private set; }
    public bool    Enabled            { get; private set; }
    /// <summary>The Entra directory (tenant) id: a GUID.</summary>
    public string? DirectoryId        { get; private set; }
    public string? ClientId           { get; private set; }
    public string? ClientSecretCipher { get; private set; }
    public DateTime UpdatedAt         { get; private set; }
    public string? UpdatedBy          { get; private set; }

    public bool IsUsable => Enabled && !string.IsNullOrWhiteSpace(DirectoryId) && !string.IsNullOrWhiteSpace(ClientId)
                            && !string.IsNullOrWhiteSpace(ClientSecretCipher);

    public void Update(bool enabled, string? directoryId, string? clientId, string? secretCipher, string? by)
    {
        Enabled = enabled; DirectoryId = directoryId?.Trim().ToLowerInvariant(); ClientId = clientId?.Trim().ToLowerInvariant();
        if (secretCipher is not null) ClientSecretCipher = secretCipher;
        UpdatedAt = DateTime.UtcNow; UpdatedBy = by;
    }
}
