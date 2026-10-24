using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Tax;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Fbr;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Tax;

internal static class TaxProfileMapping
{
    public static TaxProfileDto ToDto(TaxProfile p) => new(p.Id, p.BranchId, p.CountryCode, p.RegionCode, p.TaxLabel,
        p.RatePercent, p.FbrEnabled, p.FbrEnvironment, p.FbrPosId, !string.IsNullOrEmpty(p.FbrTokenEncrypted),
        p.FbrServiceFee, p.FbrPctCode, IsSaved: true);
}

internal sealed class GetTaxSettingsHandler(RestaurantDbContext db) : IQueryHandler<GetTaxSettingsQuery, TaxSettingsDto>
{
    public async Task<Result<TaxSettingsDto>> Handle(GetTaxSettingsQuery q, CancellationToken ct)
    {
        var rows = await db.TaxProfiles.AsNoTracking().ToListAsync(ct);
        var country = await TaxProfileResolver.WorkspaceCountryAsync(db, ct);
        var ws = rows.FirstOrDefault(r => r.BranchId == null);

        TaxProfileDto workspace;
        if (ws is not null) workspace = TaxProfileMapping.ToDto(ws);
        else
        {
            // Nothing saved yet: show what bills are charged today — the country's preset.
            var preset = TaxPresets.Find(country, TenantAmbient.Currency);
            workspace = new(null, null, preset?.Code ?? "", null, preset?.Label ?? "Tax", preset?.Rate ?? 5m,
                false, "sandbox", null, false, 1m, "98173000", IsSaved: false);
        }

        return Result.Success(new TaxSettingsDto(country, workspace,
            rows.Where(r => r.BranchId != null).Select(TaxProfileMapping.ToDto).ToList(), TaxPresets.All));
    }
}

internal sealed class SaveTaxProfileHandler(RestaurantDbContext db, ISecretProtector secrets, IBranchAccessGuard branches)
    : ICommandHandler<SaveTaxProfileCommand, TaxProfileDto>
{
    public async Task<Result<TaxProfileDto>> Handle(SaveTaxProfileCommand c, CancellationToken ct)
    {
        if (c.BranchId.HasValue && !await branches.CanWriteToBranchAsync(c.BranchId, ct))
            return Result.Failure<TaxProfileDto>(Error.Custom("Branch.Forbidden", "You are not assigned to this branch."));

        var p = await db.TaxProfiles.FirstOrDefaultAsync(x => x.BranchId == c.BranchId, ct);
        var isNew = p is null;
        p ??= new TaxProfile(c.BranchId);

        // The workspace's own FBR account is kept in Settings → FBR Integration (shared with retail POS);
        // only a branch registered separately with FBR keeps its own POS ID here.
        var fbrEnabled = c.BranchId.HasValue && c.FbrEnabled;
        string? newToken = !c.BranchId.HasValue ? null : c.FbrToken is null ? null : c.FbrToken.Trim() == "" ? "" : secrets.Protect(c.FbrToken.Trim());
        var hasToken = newToken is null ? !string.IsNullOrEmpty(p.FbrTokenEncrypted) : newToken != "";
        if (fbrEnabled && (!c.FbrPosId.HasValue || !hasToken))
            return Result.Failure<TaxProfileDto>(Error.Custom("Validation.Failed",
                "To report bills to FBR, enter the POS ID and the token FBR issued for this outlet."));

        p.SetTax(c.CountryCode, c.RegionCode, c.TaxLabel, c.RatePercent);
        p.SetFbr(fbrEnabled, c.FbrEnvironment, fbrEnabled ? c.FbrPosId : p.FbrPosId, newToken, c.FbrServiceFee, c.FbrPctCode ?? "");
        if (isNew) db.TaxProfiles.Add(p);
        await db.SaveChangesAsync(ct);
        return Result.Success(TaxProfileMapping.ToDto(p));
    }
}

internal sealed class DeleteBranchTaxProfileHandler(RestaurantDbContext db, IBranchAccessGuard branches)
    : ICommandHandler<DeleteBranchTaxProfileCommand>
{
    public async Task<Result> Handle(DeleteBranchTaxProfileCommand c, CancellationToken ct)
    {
        if (!await branches.CanWriteToBranchAsync(c.BranchId, ct))
            return Result.Failure(Error.Custom("Branch.Forbidden", "You are not assigned to this branch."));
        var p = await db.TaxProfiles.FirstOrDefaultAsync(x => x.BranchId == c.BranchId, ct);
        if (p is null) return Result.Failure(Error.NotFoundById("TaxProfile", c.BranchId));
        db.TaxProfiles.Remove(p);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class TestFbrConnectionHandler(RestaurantDbContext db, ISecretProtector secrets, Softaxis.POS.Application.Fbr.IFbrClient client)
    : ICommandHandler<TestFbrConnectionCommand, FbrTestResultDto>
{
    public async Task<Result<FbrTestResultDto>> Handle(TestFbrConnectionCommand c, CancellationToken ct)
    {
        if (c.BranchId is null)
            return Result.Success(new FbrTestResultDto(false,
                "The workspace FBR account is tested from Settings → FBR Integration.", null));
        var p = await db.TaxProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.BranchId == c.BranchId, ct);
        if (p is null || !p.FbrPosId.HasValue || string.IsNullOrEmpty(p.FbrTokenEncrypted))
            return Result.Success(new FbrTestResultDto(false, "Save the POS ID and token first.", null));
        // A test invoice in production would be a real fiscal invoice for a sale that never happened.
        if (p.FbrEnvironment != "sandbox")
            return Result.Success(new FbrTestResultDto(false,
                "Tests are only sent to the FBR sandbox. Switch to Sandbox to test, then back to Live.", null));

        var invoice = new Softaxis.POS.Application.Fbr.FbrInvoice
        {
            POSID = p.FbrPosId.Value, USIN = $"TEST-{DateTime.UtcNow:yyyyMMddHHmmss}",
            DateTime = DateTime.UtcNow.AddHours(5).ToString("yyyy-MM-dd HH:mm:ss"),
            TotalBillAmount = 116, TotalQuantity = 1, TotalSaleValue = 100, TotalTaxCharged = 16, PaymentMode = 1,
            Items = [new Softaxis.POS.Application.Fbr.FbrInvoiceItem { ItemCode = "TEST", ItemName = "Test item", Quantity = 1, PCTCode = p.FbrPctCode,
                TaxRate = 16, SaleValue = 100, TaxCharged = 16, TotalAmount = 116 }],
        };
        var o = await client.SubmitAsync(invoice, p.FbrEnvironment, secrets.Unprotect(p.FbrTokenEncrypted)!, ct);
        return Result.Success(new FbrTestResultDto(o.Success, o.Success ? "FBR accepted the test invoice." : o.Error ?? "FBR did not accept it.", o.InvoiceNumber));
    }
}

internal sealed class GetFbrQueueHandler(RestaurantDbContext db, IBranchAccessGuard branches)
    : IQueryHandler<GetFbrQueueQuery, IReadOnlyList<FbrQueueItemDto>>
{
    public async Task<Result<IReadOnlyList<FbrQueueItemDto>>> Handle(GetFbrQueueQuery q, CancellationToken ct)
    {
        var scope = await branches.ResolveReadScopeAsync(q.BranchId, ct);
        var query = db.Orders.AsNoTracking()
            .Where(o => !o.IsDeleted && o.Status == "paid" && o.FbrStatus != null && o.FbrStatus != "sent");
        query = BranchScope.Apply(query, scope);
        IReadOnlyList<FbrQueueItemDto> list = await query.OrderByDescending(o => o.CreatedAt).Take(500)
            .Select(o => new FbrQueueItemDto(o.Id, o.OrderNumber, o.Total, o.FbrStatus, o.FbrError, o.FbrAttempts,
                o.FbrInvoiceNumber, o.CreatedAt, o.BranchId))
            .ToListAsync(ct);
        return Result.Success(list);
    }
}

internal sealed class RetryFbrHandler(RestaurantDbContext db, FbrReporter reporter) : ICommandHandler<RetryFbrCommand, int>
{
    public async Task<Result<int>> Handle(RetryFbrCommand c, CancellationToken ct)
    {
        var ids = await db.Orders.AsNoTracking()
            .Where(o => !o.IsDeleted && o.Status == "paid" && (o.FbrStatus == "pending" || o.FbrStatus == "failed")
                     && (c.OrderId == null || o.Id == c.OrderId))
            .OrderBy(o => o.CreatedAt).Select(o => o.Id).Take(200).ToListAsync(ct);
        var sent = 0;
        foreach (var id in ids)
            if ((await reporter.ReportAsync(id, ct))?.Status == "sent") sent++;
        return Result.Success(sent);
    }
}

internal sealed class GetCurrentTaxHandler(RestaurantDbContext db, Softaxis.POS.Infrastructure.Persistence.POSDbContext posDb) : IQueryHandler<GetCurrentTaxQuery, CurrentTaxDto>
{
    public async Task<Result<CurrentTaxDto>> Handle(GetCurrentTaxQuery q, CancellationToken ct)
    {
        var t = await TaxProfileResolver.ResolveAsync(db, posDb, q.BranchId, ct);
        return Result.Success(new CurrentTaxDto(t.Rate, t.Label, t.ServiceFee, t.ReportToFbr));
    }
}
