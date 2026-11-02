using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.Credits;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.LeadGen.Application.Abstractions;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Persistence;

namespace Softaxis.LeadGen.Infrastructure.Services;

/// <summary>Lead Generation credits as seen by the central Billing page: buy, show the balance, swap.</summary>
internal sealed class LeadGenCreditWallet(LeadGenDbContext db, ICreditService credits, IPlatformSettings settings) : ICreditWallet
{
    public string ModuleKey => "leadgen";
    public string DisplayName => "Lead generation";
    public string Description => "Credits pay for revealing contact details of businesses you find, so you can contact them and add them to your CRM.";
    public IReadOnlyList<string> HowItWorks =>
    [
        "Finding businesses is free. A credit is spent when you reveal a business's contact details.",
        "Revealing a contact costs the amount shown in Lead Generation settings; unusable or bounced contacts are refunded automatically.",
        "Credits are used by every campaign and search in your workspace.",
        "Credits never expire.",
    ];

    private static async Task<T> InTenantAsync<T>(Guid tenantId, Func<Task<T>> work)
    {
        var previous = (TenantAmbient.IsResolved, TenantAmbient.TenantId, TenantAmbient.IsSuperAdmin);
        try { TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true); return await work(); }
        finally { if (previous.IsResolved) TenantAmbient.Set(previous.TenantId, previous.IsSuperAdmin, true); else TenantAmbient.Clear(); }
    }

    public Task<long> BalanceAsync(Guid tenantId, CancellationToken ct) =>
        InTenantAsync(tenantId, async () => (await db.Wallets.AsNoTracking().FirstOrDefaultAsync(ct))?.Balance ?? 0L);

    public Task<bool> AddPurchasedAsync(Guid tenantId, int amount, string reason, Guid purchaseId, CancellationToken ct) =>
        InTenantAsync(tenantId, async () =>
        {
            await credits.EnsureWalletAsync(ct);
            return (await credits.AddAsync(amount, LedgerType.Purchase, reason, "purchase", purchaseId, $"purchase:{purchaseId}", ct)).Ok;
        });

    public Task<long> SwappableAsync(Guid tenantId, CancellationToken ct) =>
        InTenantAsync(tenantId, async () =>
        {
            var balance = (await db.Wallets.AsNoTracking().FirstOrDefaultAsync(ct))?.Balance ?? 0L;
            var free = await db.Ledger.AsNoTracking().Where(l => l.Type == LedgerType.Grant || (l.Type == LedgerType.Adjustment && l.Amount > 0)).SumAsync(l => (long?)l.Amount, ct) ?? 0L;
            var used = -(await db.Ledger.AsNoTracking().Where(l => l.Type == LedgerType.Spend).SumAsync(l => (long?)l.Amount, ct) ?? 0L);
            return Math.Max(0L, balance - Math.Max(0L, free - used));
        });

    public Task<bool> RemoveForSwapAsync(Guid tenantId, int amount, string reason, Guid swapId, CancellationToken ct) =>
        InTenantAsync(tenantId, async () => (await credits.RemoveAsync(amount, LedgerType.SwapOut, reason, "swap", swapId, $"swap-out:{swapId}", ct)).Ok);

    public Task<bool> AddFromSwapAsync(Guid tenantId, int amount, string reason, Guid swapId, CancellationToken ct) =>
        InTenantAsync(tenantId, async () =>
        {
            await credits.EnsureWalletAsync(ct);
            return (await credits.AddAsync(amount, LedgerType.SwapIn, reason, "swap", swapId, $"swap-in:{swapId}", ct)).Ok;
        });
}
