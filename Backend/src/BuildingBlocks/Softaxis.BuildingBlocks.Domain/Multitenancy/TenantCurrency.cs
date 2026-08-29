namespace Softaxis.BuildingBlocks.Domain.Multitenancy;

/// <summary>
/// Single source of truth for the currency a newly created record should be stamped with.
///
/// Every financial entity in this codebase used to hard-code <c>"AED"</c> as its
/// <c>CurrencyCode</c> default, so a tenant operating in PKR still had every invoice,
/// expense, deal and voucher stored as AED. The tenant's operating currency travels on
/// the JWT as the <c>currency</c> claim (Module 6e) and is published into
/// <see cref="TenantAmbient"/> per request, so entities read it from here instead.
///
/// This is deliberately a domain-level static rather than an injected service: entities
/// are constructed directly (no DI), and the same reasoning that makes
/// <see cref="TenantAmbient"/> ambient applies — the value must be resolved per request,
/// not captured once.
/// </summary>
public static class TenantCurrency
{
    /// <summary>
    /// Fallback used when no tenant currency is resolvable — an unauthenticated context,
    /// a super-admin acting outside any tenant, or a background worker that did not
    /// supply one. Matches the historical column default so nothing regresses.
    /// </summary>
    public const string Fallback = "AED";

    /// <summary>The current tenant's operating currency, or <see cref="Fallback"/>.</summary>
    public static string Resolve() => TenantAmbient.Currency ?? Fallback;

    /// <summary>
    /// Normalises a caller-supplied currency code, falling back to the tenant's own
    /// currency when the caller did not specify one. Use on create commands that expose
    /// an optional currency (import bills, foreign-currency bank accounts).
    /// </summary>
    public static string Resolve(string? preferred)
    {
        if (string.IsNullOrWhiteSpace(preferred)) return Resolve();
        var trimmed = preferred.Trim().ToUpperInvariant();
        return trimmed.Length == 3 ? trimmed : Resolve();
    }
}
