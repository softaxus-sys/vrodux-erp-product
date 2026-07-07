namespace Softaxis.Identity.Application.DTOs;

public sealed record UserDto(
    Guid     Id,
    string   Email,
    string   Username,
    string   FirstName,
    string   LastName,
    string   FullName,
    string   Status,
    bool     EmailVerified,
    string?  AvatarUrl,
    string?  PhoneNumber,
    DateTime? LastLoginAt,
    DateTime CreatedAt,
    IReadOnlyList<RoleDto> Roles,
    IReadOnlyList<PermissionOverrideDto> PermissionOverrides
);

public sealed record PermissionOverrideDto(
    Guid   PermissionId,
    string Key,
    bool   IsGranted
);

public sealed record UserSummaryDto(
    Guid     Id,
    string   Email,
    string   Username,
    string   FullName,
    string   Status,
    bool     EmailVerified,
    DateTime CreatedAt,
    int      RoleCount
);

public sealed record RoleDto(
    Guid   Id,
    string Name,
    string Description,
    bool   IsSystem,
    int    UserCount,
    IReadOnlyList<PermissionDto> Permissions
);

public sealed record RoleSummaryDto(
    Guid   Id,
    string Name,
    string Description,
    bool   IsSystem,
    int    UserCount,
    // Distinct module-prefixes this role grants permissions in (e.g. ["pos","inventory"]).
    // Lets the UI hide roles that are irrelevant to a tenant's enabled modules.
    IReadOnlyList<string> Modules
);

public sealed record PermissionDto(
    Guid   Id,
    string ModuleId,
    string Action,
    string Description,
    string Key
);

public sealed record AuditLogDto(
    Guid     Id,
    Guid?    UserId,
    string?  UserName,
    string   Action,
    string   EntityType,
    string?  EntityId,
    string?  OldValues,
    string?  NewValues,
    string?  IpAddress,
    bool     Succeeded,
    DateTime OccurredOn
);

public sealed record AuthTokenDto(
    string   AccessToken,
    string   RefreshToken,
    DateTime AccessTokenExpiry,
    UserDto? User,
    // Set when the account has 2FA enabled: no real tokens are issued yet — the client must call
    // /auth/verify-2fa with MfaToken + the authenticator code to complete login.
    bool     MfaRequired = false,
    string?  MfaToken    = null
);
