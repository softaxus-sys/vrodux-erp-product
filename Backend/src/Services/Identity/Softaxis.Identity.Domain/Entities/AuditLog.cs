using Softaxis.BuildingBlocks.Domain.Primitives;

namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// Immutable audit record written for every security-sensitive action.
/// </summary>
public sealed class AuditLog : Entity<Guid>
{
    private AuditLog() { }

    public AuditLog(
        Guid?   userId,
        string  action,
        string  entityType,
        string? entityId,
        string? oldValues,
        string? newValues,
        string? ipAddress,
        string? userAgent,
        bool    succeeded) : base(Guid.NewGuid())
    {
        UserId     = userId;
        Action     = action;
        EntityType = entityType;
        EntityId   = entityId;
        OldValues  = oldValues;
        NewValues  = newValues;
        IpAddress  = ipAddress;
        UserAgent  = userAgent;
        Succeeded  = succeeded;
        OccurredOn = DateTime.UtcNow;
    }

    public Guid?   UserId     { get; private set; }
    public string  Action     { get; private set; } = string.Empty; // LOGIN | LOGOUT | CREATE_USER | etc.
    public string  EntityType { get; private set; } = string.Empty;
    public string? EntityId   { get; private set; }
    public string? OldValues  { get; private set; } // JSON
    public string? NewValues  { get; private set; } // JSON
    public string? IpAddress  { get; private set; }
    public string? UserAgent  { get; private set; }
    public bool    Succeeded  { get; private set; }
    public DateTime OccurredOn { get; private set; }

    // Navigation
    public User? User { get; private set; }
}
