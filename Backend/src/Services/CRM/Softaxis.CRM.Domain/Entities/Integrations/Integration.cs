namespace Softaxis.CRM.Domain.Entities.Integrations;

/// <summary>
/// A tenant's connection to a single external lead source (Meta, Google, a generic
/// webhook, etc.). Provider-agnostic by design: provider-specific data lives in the
/// opaque <see cref="Config"/> / <see cref="Credentials"/> JSON blobs, the selected
/// <see cref="Resources"/> (pages / forms / sheets), and the <see cref="FieldMappings"/>.
///
/// Tenant isolation is automatic — this type lives under <c>Softaxis.CRM.Domain</c>,
/// so <c>CrmDbContext</c> adds the shadow <c>TenantId</c> column + global query filter.
/// </summary>
public sealed class Integration
{
    private Integration() { }

    public Integration(string providerKey, string name)
    {
        Id          = Guid.NewGuid();
        ProviderKey = providerKey.Trim().ToLowerInvariant();
        Name        = name.Trim();
        Status      = IntegrationStatus.Disconnected;
        Health      = IntegrationHealth.Unknown;
        // Opaque, unguessable public key used in inbound webhook / custom-API URLs.
        InboundKey  = GenerateInboundKey();
        CreatedAt   = DateTime.UtcNow;
    }

    public Guid    Id          { get; private set; }
    public string  ProviderKey { get; private set; } = string.Empty;
    public string  Name        { get; private set; } = string.Empty;
    public string  Status      { get; private set; } = IntegrationStatus.Disconnected;
    public string  Health      { get; private set; } = IntegrationHealth.Unknown;

    /// <summary>Opaque provider-specific settings (page id, form id, sheet id, options…). JSON.</summary>
    public string? Config      { get; private set; }
    /// <summary>Encrypted OAuth tokens / API secrets. NEVER returned to the client. JSON, IDataProtection-wrapped.</summary>
    public string? Credentials { get; private set; }

    /// <summary>Public key embedded in inbound URLs (identifies tenant + integration).</summary>
    public string  InboundKey  { get; private set; } = string.Empty;
    /// <summary>Encrypted HMAC signing secret for verifying inbound webhook payloads.</summary>
    public string? SigningSecret { get; private set; }

    /// <summary>Duplicate-detection rules. JSON: { "byEmail": true, "byPhone": true, "byExternalId": true }.</summary>
    public string? DedupeConfig  { get; private set; }
    /// <summary>Lead-routing rules. JSON: { "mode": "fixed|round_robin|unassigned", "assignTo": "...", "pool": [...] }.</summary>
    public string? RoutingConfig { get; private set; }

    // ── Health / sync telemetry ───────────────────────────────────────────────
    public DateTime? LastSyncAt    { get; private set; }
    public DateTime? LastSuccessAt { get; private set; }
    public DateTime? LastFailureAt { get; private set; }
    public string?   LastError     { get; private set; }
    public int       RetryCount    { get; private set; }
    /// <summary>Rotating cursor used by the round-robin router.</summary>
    public int       RoutingCursor { get; private set; }

    public bool      IsDeleted { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public ICollection<FieldMapping>        FieldMappings { get; private set; } = new List<FieldMapping>();
    public ICollection<IntegrationResource> Resources     { get; private set; } = new List<IntegrationResource>();

    // ── Behaviour ─────────────────────────────────────────────────────────────

    public void SetConfig(string? configJson)       { Config = configJson; Touch(); }
    public void SetCredentials(string? encrypted)    { Credentials = encrypted; Touch(); }
    public void SetSigningSecret(string? encrypted)  { SigningSecret = encrypted; Touch(); }
    public void SetDedupeConfig(string? json)        { DedupeConfig = json; Touch(); }
    public void SetRoutingConfig(string? json)       { RoutingConfig = json; Touch(); }
    public void Rename(string name)                  { Name = name.Trim(); Touch(); }

    public void MarkConnected()
    {
        Status = IntegrationStatus.Connected;
        Health = IntegrationHealth.Healthy;
        LastError = null; RetryCount = 0;
        Touch();
    }

    public void MarkDisconnected()
    {
        Status = IntegrationStatus.Disconnected;
        Health = IntegrationHealth.Unknown;
        Credentials = null; SigningSecret = null;
        Touch();
    }

    public void RecordSyncSuccess()
    {
        LastSyncAt = DateTime.UtcNow; LastSuccessAt = DateTime.UtcNow;
        LastError = null; RetryCount = 0;
        Health = IntegrationHealth.Healthy;
        if (Status == IntegrationStatus.Error) Status = IntegrationStatus.Connected;
        Touch();
    }

    public void RecordSyncFailure(string error)
    {
        LastSyncAt = DateTime.UtcNow; LastFailureAt = DateTime.UtcNow;
        LastError = error.Length > 1000 ? error[..1000] : error;
        RetryCount++;
        Health = RetryCount >= 3 ? IntegrationHealth.Down : IntegrationHealth.Degraded;
        Status = IntegrationStatus.Error;
        Touch();
    }

    public int NextRoutingCursor(int poolSize)
    {
        if (poolSize <= 0) return 0;
        var current = RoutingCursor % poolSize;
        RoutingCursor = (current + 1) % poolSize;
        Touch();
        return current;
    }

    public void RotateInboundKey() { InboundKey = GenerateInboundKey(); Touch(); }
    public void Delete()           { IsDeleted = true; Touch(); }

    private void Touch() => UpdatedAt = DateTime.UtcNow;

    private static string GenerateInboundKey() =>
        Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(20)).ToLowerInvariant();
}

public static class IntegrationStatus
{
    public const string Connected    = "connected";
    public const string Disconnected = "disconnected";
    public const string Error        = "error";
}

public static class IntegrationHealth
{
    public const string Healthy  = "healthy";
    public const string Degraded = "degraded";
    public const string Down     = "down";
    public const string Unknown  = "unknown";
}
