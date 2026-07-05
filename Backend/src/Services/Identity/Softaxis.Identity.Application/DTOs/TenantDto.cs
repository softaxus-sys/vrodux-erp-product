namespace Softaxis.Identity.Application.DTOs;

public sealed record TenantDto(
    Guid                    Id,
    string                  Name,
    string                  Slug,
    string                  Plan,
    string                  DeploymentType,
    string                  Status,
    string?                 ContactEmail,
    string?                 ContactPhone,
    string?                 Country,
    string?                 PrimaryColor,
    string?                 Industry,
    string?                 Currency,
    bool                    HasLicenseKey,
    DateTime?               LicenseExpiresAt,
    DateTime?               LastHeartbeatAt,
    DateTime?               TrialEndsAt,
    int                     MaxUsers,
    int                     MaxWarehouses,
    IReadOnlyList<string>   ResolvedModules,
    DateTime                CreatedAt);

public sealed record CreateTenantRequest(
    string  Name,
    string  Slug,
    string  Plan,
    string  DeploymentType,
    string? ContactEmail,
    string? Country,
    string? Industry = null,
    string? Currency = null,
    bool    StartTrial = true,
    // Optional: provision the tenant's first admin login user in the same call.
    string? AdminEmail     = null,
    string? AdminUsername  = null,
    string? AdminFirstName = null,
    string? AdminLastName  = null,
    string? AdminPassword  = null);

public sealed record SetIndustryRequest(string? Industry);

public sealed record UpdateTenantRequest(
    string  Name,
    string? ContactEmail,
    string? ContactPhone,
    string? Country,
    string? PrimaryColor);

public sealed record ChangePlanRequest(string Plan);

public sealed record GenerateLicenseRequest(
    int      ValidityDays,
    string[] Features);

public sealed record GenerateLicenseResponse(
    string   LicenseKey,
    DateTime ExpiresAt);

public sealed record SetConnectionStringsRequest(
    string IdentityDb,
    string PosDb,
    string InventoryDb);

/// <summary>
/// Renew a cloud tenant's subscription by setting a new expiry date.
/// The tenant is activated automatically.
/// </summary>
public sealed record RenewSubscriptionRequest(DateTime ExpiresAt);

/// <summary>
/// Set or clear a custom module list for a tenant.
/// <see cref="Modules"/> = null → reset to plan defaults.
/// </summary>
public sealed record SetModulesRequest(IReadOnlyList<string>? Modules);

public sealed record TenantUserCountDto(
    Guid TenantId,
    int  Count,
    int  MaxUsers,
    int  Remaining,
    bool AtLimit);
