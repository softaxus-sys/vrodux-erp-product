using Softaxis.BuildingBlocks.Domain.Primitives;

namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// Refresh token — stored hashed, revoked on use (rotation strategy).
/// </summary>
public sealed class RefreshToken : Entity<Guid>
{
    private RefreshToken() { }

    public RefreshToken(Guid userId, string tokenHash, DateTime expiresAt, string? createdByIp = null) : base(Guid.NewGuid())
    {
        UserId        = userId;
        TokenHash     = tokenHash;
        ExpiresAt     = expiresAt;
        CreatedAt     = DateTime.UtcNow;
        CreatedByIp   = createdByIp;
    }

    public Guid     UserId       { get; private set; }
    public string   TokenHash    { get; private set; } = string.Empty;
    public DateTime CreatedAt    { get; private set; }
    public DateTime ExpiresAt    { get; private set; }
    public string?  CreatedByIp  { get; private set; }
    public DateTime? RevokedAt   { get; private set; }
    public string?  RevokedByIp  { get; private set; }
    public string?  ReplacedByTokenHash { get; private set; }

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
