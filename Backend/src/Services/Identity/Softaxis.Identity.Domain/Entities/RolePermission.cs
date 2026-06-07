namespace Softaxis.Identity.Domain.Entities;

/// <summary>Join entity for many-to-many Role ↔ Permission.</summary>
public sealed class RolePermission
{
    public Guid RoleId       { get; init; }
    public Guid PermissionId { get; init; }

    public Role       Role       { get; init; } = null!;
    public Permission Permission { get; init; } = null!;
}
