namespace Softaxis.Identity.Application.License.Dtos;

public sealed record LicenseHeartbeatResultDto(
    bool     Valid,
    string   Plan,
    int      MaxUsers,
    DateTime ExpiresAt,
    DateTime ServerTime);

public sealed record LicenseValidationDto(
    bool      Valid,
    Guid?     TenantId   = null,
    string?   TenantSlug = null,
    string?   Plan       = null,
    int?      MaxUsers   = null,
    string[]? Features   = null,
    DateTime? IssuedAt   = null,
    DateTime? ExpiresAt  = null);

public sealed record LicenseActivationDto(
    bool                  Activated,
    /// <summary>True when the key was already the one installed — re-pasting it is not an error.</summary>
    bool                  AlreadyInUse,
    string                TenantName,
    string                Plan,
    int                   MaxUsers,
    IReadOnlyList<string> Modules,
    DateTime              ExpiresAt,
    int                   DaysLeft);

/// <summary>
/// What the activation screen shows before a key is pasted. Deliberately thin: it is served
/// anonymously to anyone who can reach the server, so it carries no workspace name, no user
/// counts and no key — only whether this installation is licensed and until when.
/// </summary>
public sealed record LicenseStatusDto(
    bool      IsOnPremises,
    bool      Licensed,
    DateTime? ExpiresAt,
    int?      DaysLeft,
    bool      Expired,
    // This machine's code, so an offline site can read it off the activation screen and send it
    // to Softaxis for a machine-bound key. A salted hash — reveals nothing about the machine.
    string?   MachineCode = null);
