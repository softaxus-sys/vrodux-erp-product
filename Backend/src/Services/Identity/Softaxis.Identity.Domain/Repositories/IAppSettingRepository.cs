using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Domain.Repositories;

/// <summary>
/// Application settings are TENANT-SCOPED. Every method takes the caller's tenant so one tenant's
/// company profile, regional preferences or module toggles can never be read or overwritten by
/// another. Legacy rows with a NULL TenantId are ignored for tenant users.
/// </summary>
public interface IAppSettingRepository
{
    /// <summary>Load the tenant's company-wide rows (UserId = null) + a specific user's rows.</summary>
    Task<List<AppSetting>> GetAllForUserAsync(string userId, Guid? tenantId, CancellationToken ct = default);

    /// <summary>Load the tenant's rows for a category, scoped to a specific user or company-wide.</summary>
    Task<List<AppSetting>> GetByCategoryAsync(string category, string? userId, Guid? tenantId, CancellationToken ct = default);

    void Add(AppSetting setting);
}
