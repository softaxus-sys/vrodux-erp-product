using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.AppSettings.Queries.GetAllSettings;

public sealed class GetAllSettingsQueryHandler(IAppSettingRepository settingRepo)
    : IQueryHandler<GetAllSettingsQuery, Dictionary<string, Dictionary<string, string>>>
{
    public async Task<Result<Dictionary<string, Dictionary<string, string>>>> Handle(
        GetAllSettingsQuery query, CancellationToken ct)
    {
        var rows = await settingRepo.GetAllForUserAsync(query.CurrentUserId, ct);

        // Per category, user-specific rows override company-wide defaults.
        // GroupBy key within each category to prevent ArgumentException on duplicate keys.
        var result = rows
            .GroupBy(r => r.Category)
            .ToDictionary(
                g => g.Key,
                g => g
                    .GroupBy(r => r.Key, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(
                        k => k.Key,
                        k => k.OrderByDescending(r => r.UserId != null).First().Value,
                        StringComparer.OrdinalIgnoreCase));

        return Result.Success(result);
    }
}
