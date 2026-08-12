using Microsoft.Extensions.Caching.Memory;
using Softaxis.Identity.Application.Abstractions;

namespace Softaxis.Identity.Infrastructure.Services;

/// <summary>
/// Drops the access decision that <c>SubscriptionEnforcementMiddleware</c> caches per tenant.
/// Backed by the same <see cref="IMemoryCache"/> instance the middleware uses.
/// </summary>
/// <remarks>
/// In-process only. If the gateway is ever scaled out to multiple instances, other nodes keep
/// serving their stale decision until the 60s TTL lapses — acceptable (worst case is a paying
/// customer waiting under a minute) but it would need a distributed cache to be exact.
/// </remarks>
internal sealed class MemoryCacheSubscriptionAccessCache(IMemoryCache cache) : ISubscriptionAccessCache
{
    public void Invalidate(Guid tenantId) => cache.Remove(SubscriptionCacheKeys.For(tenantId));
}
