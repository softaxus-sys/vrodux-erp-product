using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.AppSettings.Commands.UpsertAllSettings;

public sealed class UpsertAllSettingsCommandHandler(
    IAppSettingRepository settingRepo,
    IUnitOfWork           uow)
    : ICommandHandler<UpsertAllSettingsCommand>
{
    private static readonly HashSet<string> UserScopedCategories =
        new(StringComparer.OrdinalIgnoreCase) { "appearance" };

    public async Task<Result> Handle(UpsertAllSettingsCommand cmd, CancellationToken ct)
    {
        if (cmd.CategoryMap is null || cmd.CategoryMap.Count == 0)
            return Result.Failure(Error.Custom("Validation.Failed", "No settings provided."));

        var globalCats = cmd.CategoryMap.Keys
            .Where(k => !UserScopedCategories.Contains(k))
            .Select(k => k.ToLowerInvariant())
            .ToList();

        var userCats = cmd.CategoryMap.Keys
            .Where(k => UserScopedCategories.Contains(k))
            .Select(k => k.ToLowerInvariant())
            .ToList();

        // Load existing rows for each scope
        var existingGlobal = new List<AppSetting>();
        foreach (var cat in globalCats)
            existingGlobal.AddRange(await settingRepo.GetByCategoryAsync(cat, null, ct));

        var existingUser = new List<AppSetting>();
        foreach (var cat in userCats)
            existingUser.AddRange(await settingRepo.GetByCategoryAsync(cat, cmd.CurrentUserId, ct));

        // Upsert company-wide categories
        foreach (var (cat, kvp) in cmd.CategoryMap.Where(kv => !UserScopedCategories.Contains(kv.Key)))
        {
            var normalCat = cat.ToLowerInvariant();
            foreach (var (key, value) in kvp)
            {
                var row = existingGlobal.FirstOrDefault(s => s.Category == normalCat && s.Key == key);
                if (row is null)
                    settingRepo.Add(new AppSetting(normalCat, key, value, cmd.CurrentUserEmail));
                else
                    row.SetValue(value, cmd.CurrentUserEmail);
            }
        }

        // Upsert per-user categories
        foreach (var (cat, kvp) in cmd.CategoryMap.Where(kv => UserScopedCategories.Contains(kv.Key)))
        {
            var normalCat = cat.ToLowerInvariant();
            foreach (var (key, value) in kvp)
            {
                var row = existingUser.FirstOrDefault(s => s.Category == normalCat && s.Key == key);
                if (row is null)
                    settingRepo.Add(new AppSetting(normalCat, key, value, cmd.CurrentUserId, cmd.CurrentUserEmail));
                else
                    row.SetValue(value, cmd.CurrentUserEmail);
            }
        }

        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
