using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.Credits;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Crawl;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Credits;

/// <summary>SEO audit credits as seen by the central Billing page: buy, show the balance, swap.</summary>
internal sealed class SeoCreditWallet(SeoDbContext db, ISeoCreditService credits, SeoOptions options) : ICreditWallet
{
    public string ModuleKey => "seo";
    public string DisplayName => "SEO audits";
    public string Description => "Credits pay for website audits: we crawl your site the way Google does and tell you what to fix.";
    public IReadOnlyList<string> HowItWorks =>
    [
        $"1 credit checks about {options.PagesPerCredit} pages of your website (up to {options.MaxPagesPerAudit} pages per audit).",
        "You are charged for the pages actually checked, and nothing if an audit fails.",
        "Run audits from SEO, then your site, then Run audit. The cost is shown before you start.",
        "Credits never expire.",
    ];

    // The tenant filter is driven by the ambient tenant, and a webhook has none, so each call steps into the tenant and back out.
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
            return (await credits.AddAsync(amount, SeoCreditTypes.Purchase, reason, "purchase", purchaseId, $"purchase:{purchaseId}", ct)).Ok;
        });

    public Task<long> SwappableAsync(Guid tenantId, CancellationToken ct) =>
        InTenantAsync(tenantId, async () =>
        {
            var balance = (await db.Wallets.AsNoTracking().FirstOrDefaultAsync(ct))?.Balance ?? 0L;
            var free = await db.CreditLedger.AsNoTracking().Where(l => l.Type == SeoCreditTypes.Grant || (l.Type == SeoCreditTypes.Adjustment && l.Amount > 0)).SumAsync(l => (long?)l.Amount, ct) ?? 0L;
            var used = -(await db.CreditLedger.AsNoTracking().Where(l => l.Type == SeoCreditTypes.Spend).SumAsync(l => (long?)l.Amount, ct) ?? 0L);
            return Math.Max(0L, balance - Math.Max(0L, free - used));
        });

    public Task<bool> RemoveForSwapAsync(Guid tenantId, int amount, string reason, Guid swapId, CancellationToken ct) =>
        InTenantAsync(tenantId, async () => (await credits.RemoveAsync(amount, SeoCreditTypes.SwapOut, reason, "swap", swapId, $"swap-out:{swapId}", ct)).Ok);

    public Task<bool> AddFromSwapAsync(Guid tenantId, int amount, string reason, Guid swapId, CancellationToken ct) =>
        InTenantAsync(tenantId, async () =>
        {
            await credits.EnsureWalletAsync(ct);
            return (await credits.AddAsync(amount, SeoCreditTypes.SwapIn, reason, "swap", swapId, $"swap-in:{swapId}", ct)).Ok;
        });
}
