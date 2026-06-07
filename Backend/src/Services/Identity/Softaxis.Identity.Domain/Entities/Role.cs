using Softaxis.BuildingBlocks.Domain.Primitives;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.Identity.Domain.Entities;

/// <summary>
/// Role aggregate root.
/// System roles (Super Admin, etc.) cannot be deleted.
/// </summary>
public sealed class Role : AuditableEntity<Guid>
{
    private readonly List<RolePermission> _rolePermissions = [];
    private readonly List<UserRole>       _userRoles       = [];

    private Role() { }

    private Role(Guid id, string name, string description, bool isSystem) : base(id)
    {
        Name        = name;
        Description = description;
        IsSystem    = isSystem;
        CreatedAt   = DateTime.UtcNow;
    }

    public string Name        { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public bool   IsSystem    { get; private set; }

    public IReadOnlyCollection<RolePermission> RolePermissions => _rolePermissions.AsReadOnly();
    public IReadOnlyCollection<UserRole>       UserRoles       => _userRoles.AsReadOnly();

    public static Result<Role> Create(string name, string description, bool isSystem = false)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Result.Failure<Role>(Error.Custom("Role.Name.Empty", "Role name is required."));

        if (name.Length > 100)
            return Result.Failure<Role>(Error.Custom("Role.Name.TooLong", "Role name cannot exceed 100 characters."));

        return Result.Success(new Role(Guid.NewGuid(), name.Trim(), description.Trim(), isSystem));
    }

    public Result Update(string name, string description)
    {
        if (string.IsNullOrWhiteSpace(name))
            return Result.Failure(Error.Custom("Role.Name.Empty", "Role name is required."));

        Name        = name.Trim();
        Description = description.Trim();
        UpdatedAt   = DateTime.UtcNow;
        return Result.Success();
    }

    public void SetPermissions(IEnumerable<Guid> permissionIds)
    {
        _rolePermissions.Clear();
        foreach (var pid in permissionIds.Distinct())
            _rolePermissions.Add(new RolePermission { RoleId = Id, PermissionId = pid });
        UpdatedAt = DateTime.UtcNow;
    }

    public void AddPermission(Guid permissionId)
    {
        if (_rolePermissions.Any(rp => rp.PermissionId == permissionId)) return;
        _rolePermissions.Add(new RolePermission { RoleId = Id, PermissionId = permissionId });
        UpdatedAt = DateTime.UtcNow;
    }

    public void RemovePermission(Guid permissionId)
    {
        var rp = _rolePermissions.FirstOrDefault(x => x.PermissionId == permissionId);
        if (rp is not null) _rolePermissions.Remove(rp);
        UpdatedAt = DateTime.UtcNow;
    }
}
