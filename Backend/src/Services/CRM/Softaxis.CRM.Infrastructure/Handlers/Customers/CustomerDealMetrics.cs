using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Handlers.Customers;

/// <summary>
/// An account's revenue and open-pipeline figures, derived from its deals.
///
/// <para>These were once columns on <c>CrmCustomer</c> written only by the demo seeder — nothing in
/// the application ever updated them, so every account created by a real user showed 0.00 revenue
/// and 0 open deals no matter how many deals it had. Deriving them on read means the card can never
/// disagree with the deals list beneath it.</para>
/// </summary>
internal readonly record struct CustomerDealMetrics(decimal Revenue, int OpenDeals)
{
    /// <summary>An account with no deals — not an absent value.</summary>
    public static readonly CustomerDealMetrics None = new(0m, 0);
}

internal static class CustomerDealMetricsQuery
{
    /// <summary>Only a won deal is revenue; anything still in the pipeline is a forecast.</summary>
    public const string WonStage = "won";

    /// <summary>Deals that can still move — the "Open Deals" figure on the account card.</summary>
    public const string LostStage = "lost";

    /// <summary>
    /// Metrics for the given accounts, keyed by customer id. Accounts with no deals are absent from
    /// the dictionary; read through <see cref="Of"/> so they come back as zero rather than throwing.
    ///
    /// <para><paramref name="deals"/> must be the caller's ACCESS-SCOPED deal set. A user who can
    /// only see their own deals would otherwise get a revenue figure that no list on the screen
    /// adds up to.</para>
    /// </summary>
    public static async Task<Dictionary<Guid, CustomerDealMetrics>> ForAsync(
        IQueryable<Deal> deals, IReadOnlyCollection<Guid> customerIds, CancellationToken ct)
    {
        if (customerIds.Count == 0) return [];

        // The conditional sums keep this a single grouped SQL query. A filtered aggregate written as
        // g.Where(...).Sum(...) does not translate.
        var rows = await Linked(deals)
            .Where(d => customerIds.Contains(d.CustomerId!.Value))
            .GroupBy(d => d.CustomerId!.Value)
            .Select(g => new
            {
                CustomerId = g.Key,
                // The amount actually banked, not the amount quoted: a deal negotiated down at
                // signing must not keep reporting its asking price as revenue. ClosedValue is
                // defaulted to Value the moment a deal is won, so this is never null in practice —
                // the ?? only covers rows closed before the column existed.
                Revenue    = g.Sum(d => d.Stage == WonStage ? (d.ClosedValue ?? d.Value) : 0m),
                OpenDeals  = g.Sum(d => d.Stage != WonStage && d.Stage != LostStage ? 1 : 0),
            })
            .ToListAsync(ct);

        return rows.ToDictionary(r => r.CustomerId, r => new CustomerDealMetrics(r.Revenue, r.OpenDeals));
    }

    /// <summary>Zero for an account with no deals, so callers never have to special-case it.</summary>
    public static CustomerDealMetrics Of(this IReadOnlyDictionary<Guid, CustomerDealMetrics> metrics, Guid customerId) =>
        metrics.TryGetValue(customerId, out var m) ? m : CustomerDealMetrics.None;

    // The tenant filter replaces any entity-level soft-delete filter, so !IsDeleted is manual.
    // Deals with no CustomerId are free-text companies that belong to no account.
    public static IQueryable<Deal> Linked(IQueryable<Deal> deals) =>
        deals.Where(d => !d.IsDeleted && d.CustomerId != null);
}
