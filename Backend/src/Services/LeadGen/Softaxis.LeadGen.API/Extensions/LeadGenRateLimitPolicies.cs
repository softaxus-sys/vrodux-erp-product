using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;

namespace Softaxis.LeadGen.API.Extensions;

/// <summary>
/// Rate limits for the anonymous endpoints (unsubscribe pages, the mailbox sign-in callback). The
/// gateway is the real host, so it must call <see cref="AddLeadGenRateLimiting"/> — an
/// [EnableRateLimiting] attribute naming a policy nobody registered throws on the first request.
/// </summary>
public static class LeadGenRateLimitPolicies
{
    public const string Public = "leadgen_public";

    public static IServiceCollection AddLeadGenRateLimiting(this IServiceCollection services) =>
        services.AddRateLimiter(rl =>
        {
            rl.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            // Keyed by the connection's address, not a forwarded header: a header is the caller's to set.
            rl.AddPolicy(Public, ctx => RateLimitPartition.GetSlidingWindowLimiter(
                ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = 60, Window = TimeSpan.FromSeconds(60), SegmentsPerWindow = 6,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst, QueueLimit = 0,
                }));
        });
}
