namespace Softaxis.Restaurant.Domain.Entities;

/// <summary>
/// A link between one branch and an online ordering platform (Foodpanda / Delivery Hero). Orders the
/// platform sends to <see cref="InboundKey"/> land on the branch's till; accept / reject / ready are
/// reported back with the stored credentials.
/// </summary>
public sealed class PlatformConnection
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Platform { get; private set; } = "foodpanda";
    /// <summary>"sandbox" (Delivery Hero staging) | "production".</summary>
    public string Environment { get; private set; } = "sandbox";
    public Guid BranchId { get; private set; }
    /// <summary>The id this branch is known by on the platform's side ("remote id" / POS vendor id).</summary>
    public string RemoteId { get; private set; } = null!;
    /// <summary>Unguessable part of the URL the platform posts to; identifies the workspace.</summary>
    public string InboundKey { get; private set; } = null!;
    public string? Username { get; private set; }
    public string? PasswordEncrypted { get; private set; }
    /// <summary>Secret the platform signs its calls with; incoming orders without it are refused.</summary>
    public string? PluginSecretEncrypted { get; private set; }
    public bool AutoAccept { get; private set; }
    /// <summary>Minutes quoted to the platform when an order is accepted.</summary>
    public int DefaultPrepMinutes { get; private set; } = 20;
    public bool IsEnabled { get; private set; } = true;
    public DateTime? LastOrderAt { get; private set; }
    public string? LastError { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    private PlatformConnection() { }

    public PlatformConnection(string platform, Guid branchId, string remoteId, string inboundKey)
    {
        Platform = platform; BranchId = branchId; RemoteId = remoteId.Trim(); InboundKey = inboundKey;
    }

    public void Configure(string environment, Guid branchId, string remoteId, string? username,
        string? newPasswordEncrypted, string? newPluginSecretEncrypted, bool autoAccept, int prepMinutes, bool enabled)
    {
        Environment = environment == "production" ? "production" : "sandbox";
        BranchId = branchId; RemoteId = remoteId.Trim();
        Username = string.IsNullOrWhiteSpace(username) ? null : username.Trim();
        if (newPasswordEncrypted is not null) PasswordEncrypted = newPasswordEncrypted;
        if (newPluginSecretEncrypted is not null) PluginSecretEncrypted = newPluginSecretEncrypted;
        AutoAccept = autoAccept; DefaultPrepMinutes = Math.Clamp(prepMinutes, 5, 180); IsEnabled = enabled;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RecordOrder() { LastOrderAt = DateTime.UtcNow; LastError = null; UpdatedAt = DateTime.UtcNow; }
    public void RecordError(string error) { LastError = error.Length > 500 ? error[..500] : error; UpdatedAt = DateTime.UtcNow; }
}
