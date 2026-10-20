using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Persistence;

namespace Softaxis.LeadGen.Infrastructure.Services;

/// <summary>
/// The one place a paid purchase becomes credits. Called by the Stripe webhook and by the PayPal
/// capture, both of which can arrive more than once and in either order — so it is idempotent: the
/// purchase moves pending → paid exactly once, and the ledger key (<c>purchase:{id}</c>) would stop
/// a second posting even if two calls raced.
/// </summary>
public interface ICreditFulfilment
{
    Task<bool> FulfilAsync(string provider, string providerRef, long? paidAmountMinor, string? paidCurrency, CancellationToken ct);
    Task FailAsync(string provider, string providerRef, string reason, CancellationToken ct);
}

internal sealed class CreditFulfilment(
    LeadGenDbContext db, ICreditService credits, ILogger<CreditFulfilment> logger) : ICreditFulfilment
{
    public async Task<bool> FulfilAsync(string provider, string providerRef, long? paidAmountMinor, string? paidCurrency, CancellationToken ct)
    {
        // A webhook has no signed-in user and so no ambient tenant; the purchase row says whose it is.
        var row = await db.Purchases.IgnoreQueryFilters()
            .Where(p => p.Provider == provider && p.ProviderRef == providerRef)
            .Select(p => new { Purchase = p, TenantId = EF.Property<Guid?>(p, "TenantId") })
            .FirstOrDefaultAsync(ct);
        if (row?.TenantId is not { } tenantId)
        {
            logger.LogWarning("Payment for unknown {Provider} reference {Ref}.", provider, providerRef);
            return false;
        }

        var purchase = row.Purchase;
        if (purchase.Status == PurchaseStatus.Paid) return true;          // already done

        // The amount that arrived must be the amount we asked for. A mismatch is never credited.
        if (paidAmountMinor is { } paid && (paid != purchase.AmountMinor
            || (paidCurrency is not null && !paidCurrency.Equals(purchase.Currency, StringComparison.OrdinalIgnoreCase))))
        {
            purchase.MarkFailed($"Amount mismatch: expected {purchase.AmountMinor} {purchase.Currency}, received {paid} {paidCurrency}.");
            await db.SaveChangesAsync(ct);
            logger.LogError("Credit purchase {Id} amount mismatch.", purchase.Id);
            return false;
        }

        var previous = (TenantAmbient.IsResolved, TenantAmbient.TenantId, TenantAmbient.IsSuperAdmin);
        try
        {
            TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
            var result = await credits.AddAsync(purchase.Credits, LedgerType.Purchase,
                $"Bought {purchase.PackName} ({purchase.Credits:N0} credits)", "purchase", purchase.Id, $"purchase:{purchase.Id}", ct);
            if (!result.Ok) return false;

            purchase.MarkPaid();
            await db.SaveChangesAsync(ct);
            return true;
        }
        finally
        {
            if (previous.IsResolved) TenantAmbient.Set(previous.TenantId, previous.IsSuperAdmin, true);
            else TenantAmbient.Clear();
        }
    }

    public async Task FailAsync(string provider, string providerRef, string reason, CancellationToken ct)
    {
        var purchase = await db.Purchases.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.Provider == provider && p.ProviderRef == providerRef && p.Status == PurchaseStatus.Pending, ct);
        if (purchase is null) return;
        purchase.MarkFailed(reason);
        await db.SaveChangesAsync(ct);
    }
}
