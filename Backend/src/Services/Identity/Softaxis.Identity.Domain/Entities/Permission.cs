using Softaxis.BuildingBlocks.Domain.Primitives;

namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// A granular permission entry — e.g. ModuleId="inventory", Action="delete".
/// Permissions are seeded at startup and never modified at runtime.
/// </summary>
public sealed class Permission : Entity<Guid>
{
    private Permission() { }

    public Permission(Guid id, string moduleId, string action, string description) : base(id)
    {
        ModuleId    = moduleId;
        Action      = action;
        Description = description;
    }

    public string ModuleId    { get; private set; } = string.Empty;
    public string Action      { get; private set; } = string.Empty; // view|create|edit|delete|approve|export|print|void|refund|discount|adjust
    public string Description { get; private set; } = string.Empty;

    // e.g. "inventory.delete"
    public string Key => $"{ModuleId}.{Action}";

    public IReadOnlyCollection<RolePermission> RolePermissions { get; } = [];
}
