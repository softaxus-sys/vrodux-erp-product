using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Billing;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Infrastructure.Persistence;

namespace Softaxis.Identity.Infrastructure.Billing;

/// <summary>
/// Cache key + TTL shared by the store and the options overlay. The TTL is only a backstop —
/// saving invalidates the entry directly, so a change takes effect on the very next request.
/// </summary>
internal static class BillingSettingsCache
{
    public const string Key = "billing:settings";
    public static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);
}

public sealed class BillingSettingsStore(IdentityDbContext db, IMemoryCache cache) : IBillingSettingsStore
{
    public async Task<BillingSettings?> GetAsync(CancellationToken ct = default)
    {
        if (cache.TryGetValue(BillingSettingsCache.Key, out BillingSettings? cached))
            return cached;

        var row = await db.BillingSettings.AsNoTracking().FirstOrDefaultAsync(ct);

        // Cached even when null: "no row yet" is the common case on a fresh install and is just as
        // worth not re-querying on every request.
        cache.Set(BillingSettingsCache.Key, row, BillingSettingsCache.Ttl);
        return row;
    }

    public async Task SaveAsync(
        bool                       stripeEnabled,
        IDictionary<string,string> stripePrices,
        bool                       payPalEnabled,
        bool                       payPalUseSandbox,
        IDictionary<string,string> payPalPlans,
        string?                    currency,
        string?                    updatedBy,
        CancellationToken          ct = default)
    {
        var row = await db.BillingSettings.FirstOrDefaultAsync(ct);
        if (row is null)
        {
            row = new BillingSettings(updatedBy);
            db.BillingSettings.Add(row);
        }

        row.Update(stripeEnabled, stripePrices, payPalEnabled, payPalUseSandbox, payPalPlans, currency, updatedBy);
        await db.SaveChangesAsync(ct);

        cache.Remove(BillingSettingsCache.Key);
    }
}

/// <summary>
/// Overlays the saved settings on top of the env-bound <see cref="BillingOptions"/>.
///
/// <para>
/// Registered as a post-configure step rather than resolved by each caller so that EVERY consumer
/// of <c>IOptionsSnapshot&lt;BillingOptions&gt;</c> — the providers, the checkout handlers, the
/// webhook handlers, and anything added later — sees the admin's values automatically. A separate
/// "config service" that callers had to remember to use would silently miss whoever forgot.
/// </para>
///
/// <para>
/// Consumers must inject <c>IOptionsSnapshot</c>, not <c>IOptions</c>: <c>IOptions</c> resolves
/// once for the lifetime of the process, so it would freeze whatever the config was at first use
/// and ignore every later save.
/// </para>
///
/// <para>
/// Secrets are never touched here. The environment remains the only source for the Stripe secret
/// key, the PayPal client id/secret, and both webhook signing secrets.
/// </para>
/// </summary>
public sealed class BillingOptionsDbOverlay(IServiceScopeFactory scopeFactory, IMemoryCache cache)
    : IPostConfigureOptions<BillingOptions>
{
    public void PostConfigure(string? name, BillingOptions options)
    {
        var row = Load();
        if (row is null) return;   // never configured — env values stand as-is

        options.Stripe.Enabled = row.StripeEnabled;
        if (row.StripePrices.Count > 0) options.Stripe.Prices = new Dictionary<string, string>(row.StripePrices);

        options.PayPal.Enabled    = row.PayPalEnabled;
        options.PayPal.UseSandbox = row.PayPalUseSandbox;
        if (row.PayPalPlans.Count > 0) options.PayPal.Plans = new Dictionary<string, string>(row.PayPalPlans);

        if (!string.IsNullOrWhiteSpace(row.Currency)) options.Currency = row.Currency;
    }

    /// <summary>
    /// Synchronous by necessity — <see cref="IPostConfigureOptions{T}"/> has no async form, and
    /// sync-over-async would be worse than a plain sync EF call. It reads the memory cache first,
    /// so the database is touched at most once per TTL (or once per save).
    /// </summary>
    private BillingSettings? Load()
    {
        if (cache.TryGetValue(BillingSettingsCache.Key, out BillingSettings? cached))
            return cached;

        try
        {
            using var scope = scopeFactory.CreateScope();
            var db  = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
            var row = db.BillingSettings.AsNoTracking().FirstOrDefault();

            cache.Set(BillingSettingsCache.Key, row, BillingSettingsCache.Ttl);
            return row;
        }
        catch
        {
            // Options are built during startup paths too (and before migrations have run on a
            // brand-new database). Falling back to the environment config is always safe — it is
            // exactly the pre-existing behaviour — whereas throwing here would take down every
            // request that touches billing.
            return null;
        }
    }
}
