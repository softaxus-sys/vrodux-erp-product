using Softaxis.BuildingBlocks.Domain.Primitives;

namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// Refresh token — stored hashed, revoked on use (rotation strategy).
/// </summary>
public sealed class RefreshToken : Entity<Guid>
{
    private RefreshToken() { }

    public RefreshToken(
        Guid userId, string tokenHash, DateTime expiresAt, string? createdByIp = null,
        string? deviceId = null, string? deviceName = null, string? platform = null) : base(Guid.NewGuid())
    {
        UserId        = userId;
        TokenHash     = tokenHash;
        ExpiresAt     = expiresAt;
        CreatedAt     = DateTime.UtcNow;
        CreatedByIp   = createdByIp;
        DeviceId      = deviceId;
        DeviceName    = deviceName;
        Platform      = platform;
    }

    public Guid     UserId       { get; private set; }
    public string   TokenHash    { get; private set; } = string.Empty;
    public DateTime CreatedAt    { get; private set; }
    public DateTime ExpiresAt    { get; private set; }
    public string?  CreatedByIp  { get; private set; }
    public DateTime? RevokedAt   { get; private set; }
    public string?  RevokedByIp  { get; private set; }
    public string?  ReplacedByTokenHash { get; private set; }

    /// <summary>
    /// Client-generated, stable across app restarts and token rotations (the client persists it
    /// itself -- see the mobile app's `device-id.ts`). Null for clients that predate this feature
    /// or never send one (e.g. a web browser today) -- those sessions just can't be individually
    /// labeled/revoked from a "my devices" list, same as before this existed.
    /// </summary>
    public string? DeviceId   { get; private set; }
    /// <summary>Human-readable label ("iPhone 15 Pro", "Chrome on Windows") -- display only.</summary>
    public string? DeviceName { get; private set; }
    /// <summary>"ios" | "android" | "web" -- display only.</summary>
    public string? Platform   { get; private set; }

    public bool IsExpired  => DateTime.UtcNow >= ExpiresAt;
    public bool IsRevoked  => RevokedAt.HasValue;
    public bool IsActive   => !IsExpired && !IsRevoked;

    // Navigation
    public User User { get; private set; } = null!;

    public void Revoke(string? ip = null, string? replacedByHash = null)
    {
        RevokedAt           = DateTime.UtcNow;
        RevokedByIp         = ip;
        ReplacedByTokenHash = replacedByHash;
    }
}
