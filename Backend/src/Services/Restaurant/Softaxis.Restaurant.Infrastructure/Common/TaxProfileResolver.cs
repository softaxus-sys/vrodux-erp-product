using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.POS.Infrastructure.Persistence;
using Softaxis.Restaurant.Application.Tax;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;
using PosProtector = Softaxis.POS.Application.Abstractions.ISecretProtector;
using RestaurantProtector = Softaxis.Restaurant.Application.Abstractions.ISecretProtector;

namespace Softaxis.Restaurant.Infrastructure.Common;

/// <summary>Which tax a new bill at a branch is charged, and how it is reported to FBR.</summary>
internal static class TaxProfileResolver
{
    public sealed record Resolved(decimal Rate, string Label, decimal ServiceFee, bool ReportToFbr);

    /// <summary>The FBR account a branch's bills go to.</summary>
    public sealed record FbrAccount(long PosId, string Token, string Environment, decimal ServiceFee, string PctCode);

    /// <summary>
    /// Rate: branch override → workspace setting → the workspace country's preset → 5% (the old fixed rate).
    /// FBR: the branch's own POS ID if it has one, otherwise the workspace's (Settings → FBR, shared with retail POS).
    /// </summary>
    public static async Task<Resolved> ResolveAsync(RestaurantDbContext db, POSDbContext posDb, Guid? branchId, CancellationToken ct)
    {
        var p = await FindProfileAsync(db, branchId, ct);
        var (rate, label) = p is not null ? (p.RatePercent, p.TaxLabel) : await PresetAsync(db, ct);
        var fbr = await FbrSetupAsync(db, posDb, branchId, ct);
        return new(rate, label, fbr?.ServiceFee ?? 0m, fbr is not null);
    }

    public static async Task<TaxProfile?> FindProfileAsync(RestaurantDbContext db, Guid? branchId, CancellationToken ct)
    {
        var rows = await db.TaxProfiles.AsNoTracking()
            .Where(x => x.BranchId == null || x.BranchId == branchId).ToListAsync(ct);
        return rows.FirstOrDefault(x => branchId.HasValue && x.BranchId == branchId)
            ?? rows.FirstOrDefault(x => x.BranchId == null);
    }

    public static bool BranchFbrReady(TaxProfile p) =>
        p.BranchId.HasValue && p.FbrEnabled && p.FbrPosId is > 0 && !string.IsNullOrEmpty(p.FbrTokenEncrypted);

    /// <summary>Whether the branch reports to FBR, and its fee — without decrypting anything.</summary>
    private static async Task<(decimal ServiceFee, bool Own)?> FbrSetupAsync(RestaurantDbContext db, POSDbContext posDb, Guid? branchId, CancellationToken ct)
    {
        if (branchId.HasValue)
        {
            var own = await db.TaxProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.BranchId == branchId, ct);
            if (own is not null && BranchFbrReady(own)) return (own.FbrServiceFee, true);
        }
        var ws = await posDb.PosSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        return ws is { FbrReady: true } ? (ws.FbrServiceFee, false) : null;
    }

    /// <summary>The account to send a bill with; null when neither the branch nor the workspace is set up.</summary>
    public static async Task<FbrAccount?> FbrAccountAsync(RestaurantDbContext db, POSDbContext posDb,
        RestaurantProtector restaurantSecrets, PosProtector posSecrets, Guid? branchId, CancellationToken ct)
    {
        if (branchId.HasValue)
        {
            var own = await db.TaxProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.BranchId == branchId, ct);
            if (own is not null && BranchFbrReady(own))
                return new(own.FbrPosId!.Value, restaurantSecrets.Unprotect(own.FbrTokenEncrypted)!, own.FbrEnvironment,
                    own.FbrServiceFee, own.FbrPctCode);
        }
        var ws = await posDb.PosSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        return ws is { FbrReady: true }
            ? new(ws.FbrPosId!.Value, posSecrets.Unprotect(ws.FbrTokenProtected)!, ws.FbrEnvironment, ws.FbrServiceFee,
                string.IsNullOrWhiteSpace(ws.FbrDefaultPctCode) ? "98173000" : ws.FbrDefaultPctCode)
            : null;
    }

    private static async Task<(decimal Rate, string Label)> PresetAsync(RestaurantDbContext db, CancellationToken ct)
    {
        var preset = TaxPresets.Find(await WorkspaceCountryAsync(db, ct), TenantAmbient.Currency);
        return preset is null ? (5m, "Tax") : (preset.Rate, preset.Label);
    }

    public static async Task<string?> WorkspaceCountryAsync(RestaurantDbContext db, CancellationToken ct)
    {
        var tenant = TenantAmbient.TenantId;
        if (tenant is null) return null;
        try
        {
            // [identity] is a reserved word and must stay bracketed.
            return await db.Database
                .SqlQuery<string>($"SELECT Country AS Value FROM [identity].[tenants] WHERE Id = {tenant.Value}")
                .FirstOrDefaultAsync(ct);
        }
        catch { return null; }   // a tax lookup must never stop a bill being rung up
    }
}
