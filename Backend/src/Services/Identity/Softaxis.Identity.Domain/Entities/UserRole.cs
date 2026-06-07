namespace Softaxis.Identity.Domain.Entities;

/// <summary>Join entity for many-to-many User ↔ Role.</summary>
public sealed class UserRole
{
    public Guid UserId { get; init; }
    public Guid RoleId { get; init; }

    public User User { get; init; } = null!;
    public Role Role { get; init; } = null!;

    public DateTime AssignedAt { get; init; } = DateTime.UtcNow;
    public string   AssignedBy { get; init; } = "system";
}
