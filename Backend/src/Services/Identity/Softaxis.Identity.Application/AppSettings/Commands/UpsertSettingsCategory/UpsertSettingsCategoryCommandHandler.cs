using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.AppSettings.Commands.UpsertSettingsCategory;

public sealed class UpsertSettingsCategoryCommandHandler(
    IAppSettingRepository settingRepo,
    IUnitOfWork           uow,
    ITenantContext        tenant)
    : ICommandHandler<UpsertSettingsCategoryCommand, Dictionary<string, string>>
{
    private static readonly HashSet<string> UserScopedCategories =
        new(StringComparer.OrdinalIgnoreCase) { "appearance" };

    public async Task<Result<Dictionary<string, string>>> Handle(
        UpsertSettingsCategoryCommand cmd, CancellationToken ct)
    {
        if (cmd.KeyValues is null || cmd.KeyValues.Count == 0)
            return Result.Failure<Dictionary<string, string>>(
                Error.Custom("Validation.Failed", "No settings provided."));

        var cat    = cmd.Category.Trim().ToLowerInvariant();
        var userId = UserScopedCategories.Contains(cat) ? cmd.CurrentUserId : null;

        var existing = await settingRepo.GetByCategoryAsync(cat, userId, tenant.TenantId, ct);

        foreach (var (key, value) in cmd.KeyValues)
        {
            var row = existing.FirstOrDefault(s => s.Key == key);
            if (row is null)
            {
                settingRepo.Add(userId is null
                    ? new AppSetting(cat, key, value, tenant.TenantId, cmd.CurrentUserEmail)
                    : new AppSetting(cat, key, value, userId, tenant.TenantId, cmd.CurrentUserEmail));
            }
            else
            {
                row.SetValue(value, cmd.CurrentUserEmail);
            }
        }

        await uow.SaveChangesAsync(ct);

        // Return updated category
        var updated = await settingRepo.GetByCategoryAsync(cat, userId, tenant.TenantId, ct);
        var result  = updated.ToDictionary(r => r.Key, r => r.Value);

        return Result.Success(result);
    }
}
