using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.AppSettings.Queries.GetSettingsCategory;

public sealed class GetSettingsCategoryQueryHandler(IAppSettingRepository settingRepo, ITenantContext tenant)
    : IQueryHandler<GetSettingsCategoryQuery, Dictionary<string, string>>
{
    /// <summary>Categories stored per-user rather than company-wide.</summary>
    private static readonly HashSet<string> UserScopedCategories =
        new(StringComparer.OrdinalIgnoreCase) { "appearance" };

    public async Task<Result<Dictionary<string, string>>> Handle(
        GetSettingsCategoryQuery query, CancellationToken ct)
    {
        var cat    = query.Category.Trim().ToLowerInvariant();
        var userId = UserScopedCategories.Contains(cat) ? query.CurrentUserId : null;

        var rows = await settingRepo.GetByCategoryAsync(cat, userId, tenant.TenantId, ct);

        var result = rows
            .GroupBy(r => r.Key, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                g => g.Key,
                g => g.First().Value,
                StringComparer.OrdinalIgnoreCase);

        return Result.Success(result);
    }
}
