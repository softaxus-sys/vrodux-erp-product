using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;

namespace Softaxis.Library.API.Extensions;

/// <summary>
/// Rate limits for the anonymous member portal. The gateway is the real host, so it must call
/// <see cref="AddLibraryPortalRateLimiting"/> — an [EnableRateLimiting] attribute naming a policy
/// nobody registered throws on the first request.
/// </summary>
public static class LibraryRateLimitPolicies
{
    /// <summary>Browsing: account, search, renew, reserve.</summary>
    public const string Portal = "library_portal";

    /// <summary>
    /// PIN checks. A PIN is six digits, so this and the per-member lock are what stand between a
    /// card number and its account. Thirty a minute, not fewer: a school or branch often sits
    /// behind one address, so every member there shares this allowance.
    /// </summary>
    public const string PortalSignIn = "library_portal_signin";

    public static IServiceCollection AddLibraryPortalRateLimiting(this IServiceCollection services) =>
        services.AddRateLimiter(rl =>
        {
            rl.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            rl.AddPolicy(Portal, ctx => PerAddress(ctx, permits: 120));
            rl.AddPolicy(PortalSignIn, ctx => PerAddress(ctx, permits: 30));
        });

    // Keyed by the connection's address, not a forwarded header: a header is the caller's to set.
    private static RateLimitPartition<string> PerAddress(HttpContext ctx, int permits) =>
        RateLimitPartition.GetSlidingWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit          = permits,
                Window               = TimeSpan.FromSeconds(60),
                SegmentsPerWindow    = 6,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit           = 0,
            });
}
