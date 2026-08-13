using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Application.Abstractions;

/// <summary>
/// Reads and writes the single <see cref="BillingSettings"/> row, cached so the options overlay
/// that runs on every request doesn't hit the database each time.
/// </summary>
public interface IBillingSettingsStore
{
    /// <summary>Current row, or null when the super admin has never saved one (pure env config).</summary>
    Task<BillingSettings?> GetAsync(CancellationToken ct = default);

    /// <summary>
    /// Upsert the single row and drop the cache, so the next request builds its
    /// <c>BillingOptions</c> from the new values rather than waiting out a TTL.
    /// </summary>
    Task SaveAsync(
        bool                       stripeEnabled,
        IDictionary<string,string> stripePrices,
        bool                       payPalEnabled,
        bool                       payPalUseSandbox,
        IDictionary<string,string> payPalPlans,
        string?                    currency,
        string?                    updatedBy,
        CancellationToken          ct = default);
}
