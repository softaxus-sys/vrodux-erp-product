using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.LeadGen.Application;
using Softaxis.LeadGen.Application.Abstractions;
using Softaxis.LeadGen.Application.Credits;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Handlers.Setup;
using Softaxis.LeadGen.Infrastructure.Persistence;
using Softaxis.LeadGen.Infrastructure.Services;

namespace Softaxis.LeadGen.Infrastructure.Handlers.Credits;

internal static class CreditMapping
{
    public static PackDto ToDto(CreditPack p) => new(p.Id, p.Name, p.Credits, p.PriceMinor, p.Currency, p.Badge, p.IsActive, p.SortOrder);

    public static PurchaseDto ToDto(CreditPurchase p) => new(
        p.Id, p.PackName, p.Credits, p.AmountMinor, p.Currency, p.Provider, p.Status, p.FailureReason,
        p.CreatedByName, p.CreatedAt, p.PaidAt);

    public static PlatformSettingsDto ToDto(PlatformSettings s) => new(
        s.Enabled, s.RevealCost, s.VerifiedEmailBonus, s.TrialGrantCredits, s.DailySearchLimit, s.DailyDiscoveryLimit,
        s.MaxResultsPerSearch, s.MaxRevealsPerRequest, s.PoolFreshDays, s.BounceRefundDays,
        SetupSupport.AllowedCountries(s), s.RequireSenderIdentity, s.MaxMailboxesPerWorkspace,
        s.MaxDailySendsPerMailbox, s.MaxDailySendsPerWorkspace, s.BounceRatePauseBp, s.ComplaintRatePauseBp, s.BlockSendingOnTrial);
}

internal sealed class GetWalletHandler(ICreditService credits, IPlatformSettings settings) : IQueryHandler<GetWalletQuery, WalletDto>
{
    public async Task<Result<WalletDto>> Handle(GetWalletQuery q, CancellationToken ct)
    {
        var w = await credits.EnsureWalletAsync(ct);
        var s = await settings.GetAsync(ct);
        return Result.Success(new WalletDto(w.Balance, w.LifetimePurchased, w.LifetimeSpent, w.LifetimeRefunded,
            w.LowBalanceAlert, w.TrialGranted, s.RevealCost, s.VerifiedEmailBonus));
    }
}

internal sealed class GetLedgerHandler(LeadGenDbContext db, ICreditService credits) : IQueryHandler<GetLedgerQuery, PagedResult<LedgerEntryDto>>
{
    public async Task<Result<PagedResult<LedgerEntryDto>>> Handle(GetLedgerQuery q, CancellationToken ct)
    {
        await credits.EnsureWalletAsync(ct);
        var page = Math.Max(1, q.Page); var size = Math.Clamp(q.PageSize, 1, 200);
        var query = db.Ledger.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q.Type)) query = query.Where(l => l.Type == q.Type);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(l => l.CreatedAt).Skip((page - 1) * size).Take(size)
            .Select(l => new LedgerEntryDto(l.Id, l.Type, l.Amount, l.BalanceAfter, l.Reason, l.RefType, l.RefId, l.ActorName, l.CreatedAt))
            .ToListAsync(ct);
        return Result.Success(new PagedResult<LedgerEntryDto>(items, total, page, size));
    }
}

internal sealed class GetPacksHandler(LeadGenDbContext db) : IQueryHandler<GetPacksQuery, IReadOnlyList<PackDto>>
{
    public async Task<Result<IReadOnlyList<PackDto>>> Handle(GetPacksQuery q, CancellationToken ct)
    {
        var packs = await db.Packs.AsNoTracking().Where(p => !p.IsDeleted && p.IsActive).OrderBy(p => p.SortOrder).ThenBy(p => p.PriceMinor).ToListAsync(ct);
        return Result.Success<IReadOnlyList<PackDto>>(packs.Select(CreditMapping.ToDto).ToList());
    }
}

internal sealed class GetPurchasesHandler(LeadGenDbContext db) : IQueryHandler<GetPurchasesQuery, IReadOnlyList<PurchaseDto>>
{
    public async Task<Result<IReadOnlyList<PurchaseDto>>> Handle(GetPurchasesQuery q, CancellationToken ct)
    {
        var rows = await db.Purchases.AsNoTracking().OrderByDescending(p => p.CreatedAt).Take(100).ToListAsync(ct);
        return Result.Success<IReadOnlyList<PurchaseDto>>(rows.Select(CreditMapping.ToDto).ToList());
    }
}

internal sealed class GetPaymentOptionsHandler(ICreditPayments payments) : IQueryHandler<GetPaymentOptionsQuery, PaymentOptionsDto>
{
    public Task<Result<PaymentOptionsDto>> Handle(GetPaymentOptionsQuery q, CancellationToken ct) =>
        Task.FromResult(Result.Success(new PaymentOptionsDto(payments.StripeConfigured, payments.PayPalConfigured)));
}

internal sealed class StartCheckoutHandler(LeadGenDbContext db, ICreditPayments payments, ICurrentUser user)
    : ICommandHandler<StartCheckoutCommand, CheckoutDto>
{
    public async Task<Result<CheckoutDto>> Handle(StartCheckoutCommand cmd, CancellationToken ct)
    {
        if (TenantAmbient.TenantId is not { } tenantId)
            return Result.Failure<CheckoutDto>(Error.Custom("Credits.Conflict", "No workspace is resolved."));

        var pack = await db.Packs.AsNoTracking().FirstOrDefaultAsync(p => p.Id == cmd.PackId && !p.IsDeleted && p.IsActive, ct);
        if (pack is null) return Result.Failure<CheckoutDto>(Error.NotFoundById("Pack", cmd.PackId));

        var stripe = cmd.Provider == "stripe";
        if (stripe ? !payments.StripeConfigured : !payments.PayPalConfigured)
            return Result.Failure<CheckoutDto>(Error.Custom("Credits.NotConfigured",
                $"{(stripe ? "Card" : "PayPal")} payments are not available yet. Please contact support."));

        // Stale pending rows are noise; keep the history honest by expiring ones abandoned for a day.
        var cutoff = DateTime.UtcNow.AddHours(-24);
        foreach (var old in await db.Purchases.Where(p => p.Status == PurchaseStatus.Pending && p.CreatedAt < cutoff).ToListAsync(ct)) old.MarkExpired();

        var purchase = new CreditPurchase(pack.Id, pack.Name, pack.Credits, pack.PriceMinor, pack.Currency, cmd.Provider, user.Id, user.Name);
        db.Purchases.Add(purchase);
        await db.SaveChangesAsync(ct);   // saved first so the id exists on the provider's side too

        var baseUrl = payments.PublicBaseUrl;
        var sep = cmd.ReturnPath.Contains('?') ? "&" : "?";
        var success = $"{baseUrl}{cmd.ReturnPath}{sep}purchase={purchase.Id}&provider={cmd.Provider}&status=success";
        var cancel = $"{baseUrl}{cmd.ReturnPath}{sep}purchase={purchase.Id}&provider={cmd.Provider}&status=cancelled";

        try
        {
            var url = stripe
                ? await payments.CreateStripeCheckoutAsync(purchase, tenantId, success, cancel, ct)
                : await payments.CreatePayPalOrderAsync(purchase, success, cancel, ct);
            await db.SaveChangesAsync(ct);
            return Result.Success(new CheckoutDto(purchase.Id, url));
        }
        catch (PaymentException ex)
        {
            purchase.MarkFailed(ex.Message);
            await db.SaveChangesAsync(ct);
            return Result.Failure<CheckoutDto>(Error.Custom("Credits.Conflict", ex.Message));
        }
    }
}

internal sealed class ConfirmPayPalHandler(LeadGenDbContext db, ICreditPayments payments, ICreditFulfilment fulfilment)
    : ICommandHandler<ConfirmPayPalCommand, PurchaseDto>
{
    public async Task<Result<PurchaseDto>> Handle(ConfirmPayPalCommand cmd, CancellationToken ct)
    {
        var purchase = await db.Purchases.FirstOrDefaultAsync(p => p.Provider == "paypal" && p.ProviderRef == cmd.OrderId, ct);
        if (purchase is null) return Result.Failure<PurchaseDto>(Error.NotFoundById("Purchase", cmd.OrderId));
        if (purchase.Status == PurchaseStatus.Paid) return Result.Success(CreditMapping.ToDto(purchase));

        var capture = await payments.CapturePayPalAsync(cmd.OrderId, ct);
        if (!capture.Completed)
        {
            await fulfilment.FailAsync("paypal", cmd.OrderId, capture.Failure ?? "Payment not completed.", ct);
            return Result.Failure<PurchaseDto>(Error.Custom("Credits.Conflict", capture.Failure ?? "The payment was not completed."));
        }

        // The order must be the one we created for this purchase.
        if (capture.CustomId != purchase.Id.ToString())
            return Result.Failure<PurchaseDto>(Error.Custom("Credits.Conflict", "This payment does not match the purchase."));

        var ok = await fulfilment.FulfilAsync("paypal", cmd.OrderId, capture.AmountMinor, capture.Currency, ct);
        db.ChangeTracker.Clear();
        var fresh = await db.Purchases.AsNoTracking().FirstAsync(p => p.Id == purchase.Id, ct);
        return ok ? Result.Success(CreditMapping.ToDto(fresh))
                  : Result.Failure<PurchaseDto>(Error.Custom("Credits.Conflict", "The payment could not be applied. Contact support with your PayPal receipt."));
    }
}

internal sealed class SetLowBalanceAlertHandler(LeadGenDbContext db, ICreditService credits) : ICommandHandler<SetLowBalanceAlertCommand>
{
    public async Task<Result> Handle(SetLowBalanceAlertCommand cmd, CancellationToken ct)
    {
        await credits.EnsureWalletAsync(ct);
        if (cmd.Threshold is < 0 or > 1_000_000) return Result.Failure(Error.Custom("Credits.Invalid", "Choose a sensible threshold."));
        var w = await db.Wallets.FirstAsync(ct);
        w.SetLowBalanceAlert(cmd.Threshold);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

// ── Platform admin ───────────────────────────────────────────────────────────────────────────

internal sealed class AdminGetPacksHandler(LeadGenDbContext db) : IQueryHandler<AdminGetPacksQuery, IReadOnlyList<PackDto>>
{
    public async Task<Result<IReadOnlyList<PackDto>>> Handle(AdminGetPacksQuery q, CancellationToken ct)
    {
        var packs = await db.Packs.AsNoTracking().Where(p => !p.IsDeleted).OrderBy(p => p.SortOrder).ThenBy(p => p.PriceMinor).ToListAsync(ct);
        return Result.Success<IReadOnlyList<PackDto>>(packs.Select(CreditMapping.ToDto).ToList());
    }
}

internal sealed class UpsertPackHandler(LeadGenDbContext db) : ICommandHandler<UpsertPackCommand, PackDto>
{
    public async Task<Result<PackDto>> Handle(UpsertPackCommand cmd, CancellationToken ct)
    {
        var i = cmd.Input;
        CreditPack pack;
        if (cmd.Id is { } id)
        {
            var existing = await db.Packs.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted, ct);
            if (existing is null) return Result.Failure<PackDto>(Error.NotFoundById("Pack", id));
            existing.Update(i.Name, i.Credits, i.PriceMinor, i.Currency, i.SortOrder, i.Badge, i.IsActive);
            pack = existing;
        }
        else
        {
            pack = new CreditPack(i.Name, i.Credits, i.PriceMinor, i.Currency, i.SortOrder, i.Badge);
            db.Packs.Add(pack);
        }
        await db.SaveChangesAsync(ct);
        return Result.Success(CreditMapping.ToDto(pack));
    }
}

internal sealed class DeletePackHandler(LeadGenDbContext db) : ICommandHandler<DeletePackCommand>
{
    public async Task<Result> Handle(DeletePackCommand cmd, CancellationToken ct)
    {
        var p = await db.Packs.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (p is null) return Result.Failure(Error.NotFoundById("Pack", cmd.Id));
        p.Delete();   // soft: past purchases keep their name and price
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetPlatformSettingsHandler(IPlatformSettings settings) : IQueryHandler<GetPlatformSettingsQuery, PlatformSettingsDto>
{
    public async Task<Result<PlatformSettingsDto>> Handle(GetPlatformSettingsQuery q, CancellationToken ct) =>
        Result.Success(CreditMapping.ToDto(await settings.GetAsync(ct)));
}

internal sealed class UpdatePlatformSettingsHandler(LeadGenDbContext db, IPlatformSettings settings)
    : ICommandHandler<UpdatePlatformSettingsCommand, PlatformSettingsDto>
{
    public async Task<Result<PlatformSettingsDto>> Handle(UpdatePlatformSettingsCommand cmd, CancellationToken ct)
    {
        var s = cmd.Settings;
        var countries = s.AllowedCountries.Select(c => c.Trim().ToUpperInvariant()).Where(c => c.Length == 2).Distinct().ToList();
        foreach (var c in countries)
            if (Application.Catalog.GeoCatalog.Get(c) is null)
                return Result.Failure<PlatformSettingsDto>(Error.Custom("Settings.Invalid", $"Unknown country {c}."));

        var row = await db.PlatformSettings.FirstOrDefaultAsync(ct);
        if (row is null) { row = PlatformSettings.CreateDefault(); db.PlatformSettings.Add(row); }
        row.Update(s.Enabled, s.RevealCost, s.VerifiedEmailBonus, s.TrialGrantCredits, s.DailySearchLimit, s.DailyDiscoveryLimit,
            s.MaxResultsPerSearch, s.MaxRevealsPerRequest, s.PoolFreshDays, s.BounceRefundDays, JsonSerializer.Serialize(countries),
            s.RequireSenderIdentity, s.MaxMailboxesPerWorkspace, s.MaxDailySendsPerMailbox, s.MaxDailySendsPerWorkspace,
            s.BounceRatePauseBp, s.ComplaintRatePauseBp, s.BlockSendingOnTrial);
        await db.SaveChangesAsync(ct);
        settings.Invalidate();
        return Result.Success(CreditMapping.ToDto(row));
    }
}

internal sealed class AdminGrantCreditsHandler(ICreditService credits, IPlatformSettings settings, ICurrentUser user)
    : ICommandHandler<AdminGrantCreditsCommand, WalletDto>
{
    public async Task<Result<WalletDto>> Handle(AdminGrantCreditsCommand cmd, CancellationToken ct)
    {
        // Operate inside the target workspace for the duration of the grant, then step back out.
        var previous = (TenantAmbient.IsResolved, TenantAmbient.TenantId, TenantAmbient.IsSuperAdmin);
        try
        {
            TenantAmbient.Set(cmd.TenantId, isSuperAdmin: false, isResolved: true);
            await credits.EnsureWalletAsync(ct);
            var type = cmd.Amount > 0 ? LedgerType.Grant : LedgerType.Adjustment;
            var res = await credits.AddAsync(cmd.Amount, type, $"{cmd.Reason} (by {user.Name ?? "platform admin"})", "admin", null,
                $"admin:{Guid.NewGuid()}", ct);
            if (!res.Ok) return Result.Failure<WalletDto>(Error.Custom("Credits.Conflict", "That would take the balance below zero."));

            var w = await credits.EnsureWalletAsync(ct);
            var s = await settings.GetAsync(ct);
            return Result.Success(new WalletDto(w.Balance, w.LifetimePurchased, w.LifetimeSpent, w.LifetimeRefunded,
                w.LowBalanceAlert, w.TrialGranted, s.RevealCost, s.VerifiedEmailBonus));
        }
        finally
        {
            if (previous.IsResolved) TenantAmbient.Set(previous.TenantId, previous.IsSuperAdmin, true);
            else TenantAmbient.Clear();
        }
    }
}
