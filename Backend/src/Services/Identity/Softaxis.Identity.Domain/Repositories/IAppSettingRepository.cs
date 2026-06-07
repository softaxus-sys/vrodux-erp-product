using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Domain.Repositories;

public interface IAppSettingRepository
{
    /// <summary>Load company-wide rows (UserId = null) + a specific user's rows.</summary>
    Task<List<AppSetting>> GetAllForUserAsync(string userId, CancellationToken ct = default);

    /// <summary>Load all rows for a category scoped to a specific user or company-wide.</summary>
    Task<List<AppSetting>> GetByCategoryAsync(string category, string? userId, CancellationToken ct = default);

    void Add(AppSetting setting);
}
