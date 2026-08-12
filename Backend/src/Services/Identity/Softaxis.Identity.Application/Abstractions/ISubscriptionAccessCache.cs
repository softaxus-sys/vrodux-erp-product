namespace Softaxis.Identity.Application.Abstractions;

/// <summary>
/// Cache-key contract shared by <c>SubscriptionEnforcementMiddleware</c> (which caches each
/// tenant's access decision for 60s) and the billing handlers (which must drop that entry the
/// instant a payment lands).
/// </summary>
public static class SubscriptionCacheKeys
{
    public static string For(Guid tenantId) => $"sub_{tenantId:N}";
}

/// <summary>
/// Lets billing invalidate a tenant's cached access decision.
/// <para>
/// Without this, a tenant that has just paid would keep getting blocked for up to a minute —
/// exactly the moment they are least willing to forgive a broken experience. Called after any
/// change to tenant status or subscription state (checkout completed, invoice paid, cancellation,
/// super-admin override).
/// </para>
/// </summary>
public interface ISubscriptionAccessCache
{
    void Invalidate(Guid tenantId);
}
