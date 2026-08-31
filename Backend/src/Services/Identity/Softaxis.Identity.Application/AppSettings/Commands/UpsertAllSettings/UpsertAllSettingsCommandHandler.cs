using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.AppSettings.Commands.UpsertAllSettings;

public sealed class UpsertAllSettingsCommandHandler(
    IAppSettingRepository settingRepo,
    IUnitOfWork           uow,
    ITenantSecurityPolicyProvider securityPolicy,
    ITenantContext        tenant)
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
            existingGlobal.AddRange(await settingRepo.GetByCategoryAsync(cat, null, tenant.TenantId, ct));

        var existingUser = new List<AppSetting>();
        foreach (var cat in userCats)
            existingUser.AddRange(await settingRepo.GetByCategoryAsync(cat, cmd.CurrentUserId, tenant.TenantId, ct));

        // Match the way SQL Server does. The unique indexes live under a case-insensitive collation,
        // so "EmailSystem" and "emailSystem" are the SAME row to the database. Matching with C#'s
        // default ordinal comparison would miss the existing row, insert, and fail on the index —
        // the same duplicate-key error the missing TenantId used to cause.
        static bool Matches(AppSetting s, string category, string key) =>
            string.Equals(s.Category, category, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(s.Key,      key,      StringComparison.OrdinalIgnoreCase);

        // Upsert company-wide categories
        foreach (var (cat, kvp) in cmd.CategoryMap.Where(kv => !UserScopedCategories.Contains(kv.Key)))
        {
            var normalCat = cat.ToLowerInvariant();
            foreach (var (key, value) in kvp)
            {
                var row = existingGlobal.FirstOrDefault(s => Matches(s, normalCat, key));
                if (row is null)
                {
                    var added = new AppSetting(normalCat, key, value, tenant.TenantId, cmd.CurrentUserEmail);
                    settingRepo.Add(added);
                    // Track it so a later case-variant of the same key in this same payload updates
                    // the pending row instead of queueing a second insert of the same key.
                    existingGlobal.Add(added);
                }
                else
                {
                    row.SetValue(value, cmd.CurrentUserEmail);
                }
            }
        }

        // Upsert per-user categories
        foreach (var (cat, kvp) in cmd.CategoryMap.Where(kv => UserScopedCategories.Contains(kv.Key)))
        {
            var normalCat = cat.ToLowerInvariant();
            foreach (var (key, value) in kvp)
            {
                var row = existingUser.FirstOrDefault(s => Matches(s, normalCat, key));
                if (row is null)
                {
                    var added = new AppSetting(normalCat, key, value, cmd.CurrentUserId, tenant.TenantId, cmd.CurrentUserEmail);
                    settingRepo.Add(added);
                    existingUser.Add(added);
                }
                else
                {
                    row.SetValue(value, cmd.CurrentUserEmail);
                }
            }
        }

        await uow.SaveChangesAsync(ct);

        // The security policy is cached per tenant, so drop it here rather than making an admin
        // wait out the TTL to see their own change take effect.
        securityPolicy.Invalidate(tenant.TenantId);

        return Result.Success();
    }
}
