namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// Per-user permission override on top of role permissions.
/// IsGranted = true  → an extra permission granted to this user beyond their roles.
/// IsGranted = false → an explicit deny that removes a role-granted permission for this user.
/// Deny always wins when computing the effective permission set.
/// </summary>
public sealed class UserPermission
{
    public Guid UserId       { get; init; }
    public Guid PermissionId { get; init; }
    public bool IsGranted    { get; init; }

    public User       User       { get; init; } = null!;
    public Permission Permission { get; init; } = null!;

    public DateTime AssignedAt { get; init; } = DateTime.UtcNow;
    public string   AssignedBy { get; init; } = "system";
}
