using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Credits;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Infrastructure.Persistence;

namespace Softaxis.Identity.Infrastructure.Billing;

/// <summary>
/// The only code that turns a payment into credits. Every route that learns about a payment — the Stripe
/// webhook, the PayPal webhook, the buyer returning from PayPal — comes through here, so the rules live once:
///
/// <list type="number">
///   <item>The amount and currency the provider reports must equal what WE priced. A mismatch is never credited.</item>
///   <item>The purchase is claimed with one guarded <c>UPDATE … WHERE Status='pending'</c>, so two routes arriving
///   together (the webhook and the return page) cannot both win.</item>
///   <item>The module wallet is told with the purchase id as its idempotency key, so a retry after a crash between
///   "paid" and "credited" adds the credits once, not twice.</item>
/// </list>
/// </summary>
internal sealed class CreditFulfiller(
    IdentityDbContext db, IEnumerable<ICreditWallet> wallets, ILogger<CreditFulfiller> logger)
{
    public async Task<Result<CreditPurchase>> FulfilAsync(
        Guid purchaseId, decimal paidAmount, string paidCurrency, string? providerPaymentId, CancellationToken ct)
    {
        var purchase = await db.CreditPurchases.FirstOrDefaultAsync(p => p.Id == purchaseId, ct);
        if (purchase is null)
            return Result.Failure<CreditPurchase>(Error.Custom("Credits.NotFound", "That credit purchase does not exist."));

        if (purchase.Status == CreditPurchaseStatus.Credited) return Result.Success(purchase);   // already done: acknowledge

        if (Math.Abs(paidAmount - purchase.TotalAmount) > 0.005m ||
            !string.Equals(paidCurrency, purchase.Currency, StringComparison.OrdinalIgnoreCase))
        {
            logger.LogError("Credit purchase {Purchase}: provider reports {Paid} {Cur} but we priced {Total} {Currency}. Not crediting.",
                purchase.Id, paidAmount, paidCurrency, purchase.TotalAmount, purchase.Currency);
            await db.CreditPurchases.Where(p => p.Id == purchase.Id && p.Status == CreditPurchaseStatus.Pending)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, CreditPurchaseStatus.Failed)
                    .SetProperty(p => p.Error, $"Amount mismatch: provider reported {paidAmount} {paidCurrency}, expected {purchase.TotalAmount} {purchase.Currency}."), ct);
            return Result.Failure<CreditPurchase>(Error.Custom("Credits.AmountMismatch", "The payment did not match the order."));
        }

        // Claim. 0 rows = someone else already moved it past 'pending' (or it failed earlier).
        var claimed = await db.CreditPurchases.Where(p => p.Id == purchase.Id && p.Status == CreditPurchaseStatus.Pending)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, CreditPurchaseStatus.Paid)
                .SetProperty(p => p.PaidAt, DateTime.UtcNow)
                .SetProperty(p => p.ProviderPaymentId, providerPaymentId), ct);
        await db.Entry(purchase).ReloadAsync(ct);
        if (claimed == 0 && purchase.Status != CreditPurchaseStatus.Paid)
            return Result.Failure<CreditPurchase>(Error.Custom("Credits.Conflict", $"This purchase is {purchase.Status}."));

        var wallet = wallets.FirstOrDefault(w => w.ModuleKey == purchase.ModuleKey);
        if (wallet is null)
        {
            logger.LogError("Credit purchase {Purchase} is paid but no wallet is registered for '{Module}'.", purchase.Id, purchase.ModuleKey);
            return Result.Failure<CreditPurchase>(Error.Custom("Credits.NoWallet", "Payment received, but the credit balance could not be found. Please contact support."));
        }

        bool ok;
        try { ok = await wallet.AddPurchasedAsync(purchase.TenantId, purchase.Credits, $"Purchased {purchase.Credits:N0} credits", purchase.Id, ct); }
        catch (Exception ex) { logger.LogError(ex, "Adding credits failed for purchase {Purchase}.", purchase.Id); ok = false; }

        if (!ok)
        {
            // Stays 'paid': the provider will retry the webhook, and the idempotent wallet call completes it.
            return Result.Failure<CreditPurchase>(Error.Custom("Credits.NotCredited", "Payment received; the credits will be added shortly."));
        }

        await db.CreditPurchases.Where(p => p.Id == purchase.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, CreditPurchaseStatus.Credited).SetProperty(p => p.CreditedAt, DateTime.UtcNow), ct);
        await db.Entry(purchase).ReloadAsync(ct);
        logger.LogInformation("Credited {Credits} {Module} credits to tenant {Tenant} (purchase {Purchase}).", purchase.Credits, purchase.ModuleKey, purchase.TenantId, purchase.Id);
        return Result.Success(purchase);
    }
}
