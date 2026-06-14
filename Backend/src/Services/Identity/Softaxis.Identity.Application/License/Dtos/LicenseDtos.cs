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
