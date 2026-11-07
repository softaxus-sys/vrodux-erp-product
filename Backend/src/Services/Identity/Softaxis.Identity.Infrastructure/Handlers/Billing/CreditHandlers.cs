using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Credits;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Billing;
using Softaxis.Identity.Application.Billing.Credits;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Infrastructure.Billing;
using Softaxis.Identity.Infrastructure.Persistence;

namespace Softaxis.Identity.Infrastructure.Handlers.Billing;

internal static class CreditSupport
{
    /// <summary>The price list, or an empty one (nothing for sale) when the platform owner has not set any.</summary>
    public static async Task<CreditPricingSettings> PricingAsync(IdentityDbContext db, CancellationToken ct) =>
        await db.CreditPricing.AsNoTracking().FirstOrDefaultAsync(ct) ?? new CreditPricingSettings();

    public static CreditPurchaseDto ToDto(CreditPurchase p) => new(
        p.Id, p.ModuleKey, p.Credits, p.UnitPrice, p.DiscountPercent, p.TotalAmount, p.Currency, p.Provider.ToString(),
        p.Status, p.Error, p.CreatedByName, p.CreatedAt, p.CreditedAt);

    public static CreditPricingDto ToDto(CreditPricingSettings s, IEnumerable<ICreditWallet> wallets) => new(
        s.PricePerCredit, s.Tiers.Select(t => new CreditTierDto(t.FromCredits, t.DiscountPercent)).ToList(),
        s.MinCredits, s.MinOrderUsd, s.MaxOrderUsd, s.VatPercent, s.SwapEnabled, s.SwapFeePercent, s.MinSwapCredits,
        wallets.Select(w => new CreditModuleInfoDto(w.ModuleKey, w.DisplayName)).ToList());

    public static CreditSwapDto ToDto(CreditSwap w) => new(
        w.Id, w.FromModule, w.ToModule, w.FromCredits, w.ToCredits, w.FromPrice, w.ToPrice, w.FeePercent, w.Status, w.Error, w.CreatedByName, w.CreatedAt);
}

internal sealed class GetCreditCatalogHandler(
    IdentityDbContext db, ICurrentUser user, IEnumerable<ICreditWallet> wallets, CreditCheckoutGateway gateway, IOptionsSnapshot<BillingOptions> options)
    : IQueryHandler<GetCreditCatalogQuery, CreditCatalogDto>
{
    public async Task<Result<CreditCatalogDto>> Handle(GetCreditCatalogQuery q, CancellationToken ct)
    {
        if (user.TenantId is not { } tenantId) return Result.Failure<CreditCatalogDto>(Error.Custom("Billing.NoTenant", "Credits are only available to tenant accounts."));
        var s = await CreditSupport.PricingAsync(db, ct);

        var products = new List<CreditProductDto>();
        foreach (var w in wallets.OrderBy(w => w.DisplayName))
        {
            long balance = 0, swappable = 0;
            try { balance = await w.BalanceAsync(tenantId, ct); swappable = await w.SwappableAsync(tenantId, ct); } catch { /* a module that cannot answer shows 0 rather than breaking the page */ }
            s.PricePerCredit.TryGetValue(w.ModuleKey, out var price);
            products.Add(new CreditProductDto(w.ModuleKey, w.DisplayName, w.Description, w.HowItWorks, w.UnitName, price > 0, price, balance, swappable));
        }

        var providers = new List<string>();
        if (gateway.StripeReady) providers.Add("Stripe");
        if (gateway.PayPalReady) providers.Add("PayPal");
        return Result.Success(new CreditCatalogDto(
            products, s.Tiers.Select(t => new CreditTierDto(t.FromCredits, t.DiscountPercent)).ToList(),
            s.MinCredits, s.MinOrderUsd, s.MaxOrderUsd, s.VatPercent, options.Value.Currency, providers, s.SwapEnabled, s.SwapFeePercent, s.MinSwapCredits));
    }
}

internal sealed class GetCreditQuoteHandler(IdentityDbContext db) : IQueryHandler<GetCreditQuoteQuery, CreditQuoteDto>
{
    public async Task<Result<CreditQuoteDto>> Handle(GetCreditQuoteQuery q, CancellationToken ct) =>
        CreditPricing.Quote(await CreditSupport.PricingAsync(db, ct), q.ModuleKey, q.Credits);
}

internal sealed class GetCreditPurchasesHandler(IdentityDbContext db, ICurrentUser user, CreditFulfiller fulfiller) : IQueryHandler<GetCreditPurchasesQuery, IReadOnlyList<CreditPurchaseDto>>
{
    public async Task<Result<IReadOnlyList<CreditPurchaseDto>>> Handle(GetCreditPurchasesQuery q, CancellationToken ct)
    {
        if (user.TenantId is not { } tenantId) return Result.Success<IReadOnlyList<CreditPurchaseDto>>([]);
        // Self-heal: a purchase that was paid but whose credits could not be added at the time (the module was briefly
        // unavailable) is completed here. The wallet call is idempotent, so this can never add them twice.
        foreach (var stuck in await db.CreditPurchases.AsNoTracking().Where(p => p.TenantId == tenantId && p.Status == CreditPurchaseStatus.Paid).ToListAsync(ct))
            await fulfiller.FulfilAsync(stuck.Id, stuck.TotalAmount, stuck.Currency, stuck.ProviderPaymentId, ct);

        // Finished purchases always; an unfinished checkout only for a day (it is an abandoned cart after that, not history).
        var since = DateTime.UtcNow.AddDays(-1);
        var rows = await db.CreditPurchases.AsNoTracking()
            .Where(p => p.TenantId == tenantId && (p.Status != CreditPurchaseStatus.Pending || p.CreatedAt > since))
            .OrderByDescending(p => p.CreatedAt).Take(100).ToListAsync(ct);
        return Result.Success<IReadOnlyList<CreditPurchaseDto>>(rows.Select(CreditSupport.ToDto).ToList());
    }
}

internal sealed class CreateCreditCheckoutHandler(
    IdentityDbContext db, ICurrentUser user, IEnumerable<ICreditWallet> wallets, CreditCheckoutGateway gateway,
    IOptionsSnapshot<BillingOptions> options)
    : ICommandHandler<CreateCreditCheckoutCommand, CreditCheckoutDto>
{
    public async Task<Result<CreditCheckoutDto>> Handle(CreateCreditCheckoutCommand cmd, CancellationToken ct)
    {
        if (user.TenantId is not { } tenantId) return Result.Failure<CreditCheckoutDto>(Error.Custom("Billing.NoTenant", "Credits are only available to tenant accounts."));
        var moduleKey = cmd.ModuleKey.Trim().ToLowerInvariant();
        var wallet = wallets.FirstOrDefault(w => w.ModuleKey == moduleKey);
        if (wallet is null) return Result.Failure<CreditCheckoutDto>(Error.Custom("Credits.NotForSale", "Those credits are not available."));

        if (!Enum.TryParse<PaymentProvider>(cmd.Provider, true, out var provider) || provider is not (PaymentProvider.Stripe or PaymentProvider.PayPal))
            return Result.Failure<CreditCheckoutDto>(Error.Custom("Validation.Failed", "Choose card (Stripe) or PayPal."));
        if (provider == PaymentProvider.Stripe && !gateway.StripeReady || provider == PaymentProvider.PayPal && !gateway.PayPalReady)
            return Result.Failure<CreditCheckoutDto>(Error.Custom("Billing.ProviderUnavailable", $"{provider} is not available right now."));

        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant is null) return Result.Failure<CreditCheckoutDto>(Error.NotFoundById(nameof(Tenant), tenantId));

        // Price on the server, from the owner's price list. The browser's idea of the price is never used.
        var quote = CreditPricing.Quote(await CreditSupport.PricingAsync(db, ct), moduleKey, cmd.Credits);
        if (quote.IsFailure) return Result.Failure<CreditCheckoutDto>(quote.Error);
        var q = quote.Value;

        var purchase = new CreditPurchase(tenantId, moduleKey, q.Credits, q.UnitPrice, q.DiscountPercent, q.NetAmount, q.VatAmount, q.TotalAmount, provider, user.Id, user.Username);
        db.CreditPurchases.Add(purchase);
        await db.SaveChangesAsync(ct);

        var baseUrl = options.Value.PublicBaseUrl.TrimEnd('/');
        var name = $"{q.Credits:N0} {wallet.DisplayName} credits";
        var description = q.DiscountPercent > 0
            ? $"{q.Credits:N0} credits at ${q.UnitPrice:0.####} each, {q.DiscountPercent:0.##}% volume discount" + (q.VatAmount > 0 ? $", VAT {q.VatPercent:0.##}% included" : "")
            : $"{q.Credits:N0} credits at ${q.UnitPrice:0.####} each" + (q.VatAmount > 0 ? $", VAT {q.VatPercent:0.##}% included" : "");
        var back = $"{baseUrl}/settings/billing?credits=";

        Result<(string Ref, string Url)> created;
        if (provider == PaymentProvider.Stripe)
        {
            // Offer the saved card of a tenant already paying us through Stripe.
            var sub = await db.Subscriptions.AsNoTracking().FirstOrDefaultAsync(s => s.TenantId == tenantId, ct);
            var customerId = sub is { Provider: PaymentProvider.Stripe } ? sub.ProviderCustomerId : null;
            created = await gateway.CreateStripeAsync(tenant, purchase, name, description, customerId, $"{back}success&purchase={purchase.Id}", $"{back}cancelled&purchase={purchase.Id}", ct);
        }
        else
            created = await gateway.CreatePayPalAsync(tenant, purchase, name, $"{back}paypal&purchase={purchase.Id}", $"{back}cancelled&purchase={purchase.Id}", ct);

        if (created.IsFailure)
        {
            purchase.MarkFailed(created.Error.Description);
            await db.SaveChangesAsync(ct);
            return Result.Failure<CreditCheckoutDto>(created.Error);
        }

        purchase.SetProviderRef(created.Value.Ref);
        await db.SaveChangesAsync(ct);
        return Result.Success(new CreditCheckoutDto(purchase.Id, created.Value.Url, provider.ToString()));
    }
}

/// <summary>The buyer came back from PayPal: take the money, then credit — through the same fulfiller as the webhook.</summary>
internal sealed class CapturePayPalCreditOrderHandler(IdentityDbContext db, ICurrentUser user, CreditCheckoutGateway gateway, CreditFulfiller fulfiller)
    : ICommandHandler<CapturePayPalCreditOrderCommand, CreditPurchaseDto>
{
    public async Task<Result<CreditPurchaseDto>> Handle(CapturePayPalCreditOrderCommand cmd, CancellationToken ct)
    {
        if (user.TenantId is not { } tenantId) return Result.Failure<CreditPurchaseDto>(Error.Custom("Billing.NoTenant", "Credits are only available to tenant accounts."));

        // Only an order WE created, for THIS workspace, can be captured.
        var purchase = await db.CreditPurchases.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Provider == PaymentProvider.PayPal && p.ProviderRef == cmd.OrderId && p.TenantId == tenantId, ct);
        if (purchase is null) return Result.Failure<CreditPurchaseDto>(Error.Custom("Credits.NotFound", "That PayPal order is not one of ours."));
        if (purchase.Status == CreditPurchaseStatus.Credited) return Result.Success(CreditSupport.ToDto(purchase));

        var capture = await gateway.CapturePayPalAsync(cmd.OrderId, ct);
        if (capture.IsFailure) return Result.Failure<CreditPurchaseDto>(capture.Error);

        var done = await fulfiller.FulfilAsync(purchase.Id, capture.Value.Amount, capture.Value.Currency, capture.Value.CaptureId, ct);
        return done.IsFailure ? Result.Failure<CreditPurchaseDto>(done.Error) : Result.Success(CreditSupport.ToDto(done.Value));
    }
}

// ── Platform owner: the price list ────────────────────────────────────────────

internal sealed class GetCreditPricingHandler(IdentityDbContext db, IEnumerable<ICreditWallet> wallets) : IQueryHandler<GetCreditPricingQuery, CreditPricingDto>
{
    public async Task<Result<CreditPricingDto>> Handle(GetCreditPricingQuery q, CancellationToken ct) =>
        Result.Success(CreditSupport.ToDto(await CreditSupport.PricingAsync(db, ct), wallets));
}

internal sealed class UpdateCreditPricingHandler(IdentityDbContext db, ICurrentUser user, IEnumerable<ICreditWallet> wallets) : ICommandHandler<UpdateCreditPricingCommand, CreditPricingDto>
{
    public async Task<Result<CreditPricingDto>> Handle(UpdateCreditPricingCommand cmd, CancellationToken ct)
    {
        var r = cmd.Request;
        if (r.MaxOrderUsd < r.MinOrderUsd) return Result.Failure<CreditPricingDto>(Error.Custom("Validation.Failed", "The largest order cannot be below the smallest."));
        var known = wallets.Select(w => w.ModuleKey).ToHashSet();
        var unknown = r.PricePerCredit.Keys.FirstOrDefault(k => !known.Contains(k.Trim().ToLowerInvariant()));
        if (unknown is not null) return Result.Failure<CreditPricingDto>(Error.Custom("Validation.Failed", $"'{unknown}' is not a module that sells credits."));

        var row = await db.CreditPricing.FirstOrDefaultAsync(ct);
        if (row is null) { row = new CreditPricingSettings(user.Username); db.CreditPricing.Add(row); }
        row.Update(r.PricePerCredit, r.Tiers.Select(t => new CreditTier(t.FromCredits, t.DiscountPercent)), r.MinCredits, r.MinOrderUsd, r.MaxOrderUsd, r.VatPercent, r.SwapEnabled, r.SwapFeePercent, r.MinSwapCredits, user.Username);
        await db.SaveChangesAsync(ct);
        return Result.Success(CreditSupport.ToDto(row, wallets));
    }
}

// ── Swapping credits between modules ──────────────────────────────────────────

internal sealed class GetCreditSwapQuoteHandler(IdentityDbContext db) : IQueryHandler<GetCreditSwapQuoteQuery, CreditSwapQuoteDto>
{
    public async Task<Result<CreditSwapQuoteDto>> Handle(GetCreditSwapQuoteQuery q, CancellationToken ct) =>
        CreditSwapPricing.Quote(await CreditSupport.PricingAsync(db, ct), q.FromModule, q.ToModule, q.Credits);
}

internal sealed class GetCreditSwapsHandler(IdentityDbContext db, ICurrentUser user, IEnumerable<ICreditWallet> wallets, ILogger<GetCreditSwapsHandler> logger)
    : IQueryHandler<GetCreditSwapsQuery, IReadOnlyList<CreditSwapDto>>
{
    public async Task<Result<IReadOnlyList<CreditSwapDto>>> Handle(GetCreditSwapsQuery q, CancellationToken ct)
    {
        if (user.TenantId is not { } tenantId) return Result.Success<IReadOnlyList<CreditSwapDto>>([]);

        // Self-heal: a swap whose credits were taken out but not yet added (a crash between the two steps) is finished here.
        // Both wallet calls are idempotent on the swap id, so finishing twice can never add twice.
        foreach (var stuck in await db.CreditSwaps.Where(w => w.TenantId == tenantId && w.Status == CreditSwap.Removed).ToListAsync(ct))
        {
            var to = wallets.FirstOrDefault(w => w.ModuleKey == stuck.ToModule);
            try
            {
                if (to is not null && await to.AddFromSwapAsync(tenantId, stuck.ToCredits, "Swap completed", stuck.Id, ct)) { stuck.MarkDone(); }
            }
            catch (Exception ex) { logger.LogError(ex, "Could not finish swap {Swap}.", stuck.Id); }
        }
        await db.SaveChangesAsync(ct);

        var rows = await db.CreditSwaps.AsNoTracking().Where(w => w.TenantId == tenantId).OrderByDescending(w => w.CreatedAt).Take(100).ToListAsync(ct);
        return Result.Success<IReadOnlyList<CreditSwapDto>>(rows.Select(CreditSupport.ToDto).ToList());
    }
}

internal sealed class SwapCreditsHandler(IdentityDbContext db, ICurrentUser user, IEnumerable<ICreditWallet> wallets, ILogger<SwapCreditsHandler> logger)
    : ICommandHandler<SwapCreditsCommand, CreditSwapDto>
{
    public async Task<Result<CreditSwapDto>> Handle(SwapCreditsCommand cmd, CancellationToken ct)
    {
        if (user.TenantId is not { } tenantId) return Result.Failure<CreditSwapDto>(Error.Custom("Billing.NoTenant", "Credits are only available to tenant accounts."));

        var quote = CreditSwapPricing.Quote(await CreditSupport.PricingAsync(db, ct), cmd.FromModule, cmd.ToModule, cmd.Credits);
        if (quote.IsFailure) return Result.Failure<CreditSwapDto>(quote.Error);
        var q = quote.Value;

        var from = wallets.FirstOrDefault(w => w.ModuleKey == q.FromModule);
        var to = wallets.FirstOrDefault(w => w.ModuleKey == q.ToModule);
        if (from is null || to is null) return Result.Failure<CreditSwapDto>(Error.Custom("Credits.NotForSale", "Those credits are not available."));

        // Only bought (or swapped-in) credits move; free ones never do.
        var swappable = await from.SwappableAsync(tenantId, ct);
        if (q.CreditsTaken > swappable)
            return Result.Failure<CreditSwapDto>(Error.Custom("Validation.Failed",
                swappable > 0 ? $"You can swap up to {swappable:N0} {from.DisplayName} credits (free credits cannot be swapped)."
                              : $"You have no {from.DisplayName} credits that can be swapped (free credits cannot be swapped)."));

        var swap = new CreditSwap(tenantId, q.FromModule, q.ToModule, q.CreditsTaken, q.CreditsReceived, q.FromPrice, q.ToPrice, q.FeePercent, user.Id, user.Username);
        db.CreditSwaps.Add(swap);
        await db.SaveChangesAsync(ct);

        var reason = $"Swapped {swap.FromCredits:N0} {from.DisplayName} credits for {swap.ToCredits:N0} {to.DisplayName} credits";

        // 1. Take from the source. The wallet refuses to go below zero.
        bool removed;
        try { removed = await from.RemoveForSwapAsync(tenantId, swap.FromCredits, reason, swap.Id, ct); }
        catch (Exception ex) { logger.LogError(ex, "Swap {Swap}: removing credits failed.", swap.Id); removed = false; }
        if (!removed)
        {
            swap.MarkFailed("Not enough credits in " + from.DisplayName + ".");
            await db.SaveChangesAsync(ct);
            return Result.Failure<CreditSwapDto>(Error.Custom("Validation.Failed", $"You do not have {swap.FromCredits:N0} {from.DisplayName} credits available."));
        }
        swap.MarkRemoved();
        await db.SaveChangesAsync(ct);

        // 2. Give to the destination. If that fails, put the credits back — nothing is left half-moved.
        bool added;
        try { added = await to.AddFromSwapAsync(tenantId, swap.ToCredits, reason, swap.Id, ct); }
        catch (Exception ex) { logger.LogError(ex, "Swap {Swap}: adding credits failed.", swap.Id); added = false; }
        if (!added)
        {
            var back = false;
            try { back = await from.AddFromSwapAsync(tenantId, swap.FromCredits, "Swap undone", swap.Id, ct); } catch (Exception ex) { logger.LogError(ex, "Swap {Swap}: undo failed.", swap.Id); }
            if (back) { swap.MarkFailed("Could not add the credits to " + to.DisplayName + "; your credits were returned."); await db.SaveChangesAsync(ct); }
            return Result.Failure<CreditSwapDto>(Error.Custom("Credits.SwapFailed",
                back ? "The swap could not be completed and your credits were returned. Please try again."
                     : "The swap is being finished; check your balances in a minute. If they do not update, contact support."));
        }

        swap.MarkDone();
        await db.SaveChangesAsync(ct);
        return Result.Success(CreditSupport.ToDto(swap));
    }
}
