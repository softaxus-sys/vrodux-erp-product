using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;

namespace Softaxis.RealEstate.API.Extensions;

/// <summary>
/// Rate limit for the website listings API. Registered by every host that loads the Real Estate
/// controllers (gateway and standalone) — an <c>[EnableRateLimiting]</c> naming an unregistered
/// policy throws at request time.
/// </summary>
public static class WebsiteRateLimitPolicies
{
    public const string WebsiteApi = "real_estate_website_api";

    public static IServiceCollection AddWebsiteApiRateLimiting(this IServiceCollection services) =>
        services.AddRateLimiter(rl =>
        {
            rl.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            rl.AddPolicy(WebsiteApi, ctx =>
            {
                // Partition by key when one is sent (a website's server may share an IP with
                // others), by client IP otherwise (image requests, bad keys).
                var key = ctx.Request.Headers["X-Api-Key"].ToString();
                var partition = string.IsNullOrEmpty(key)
                    ? "ip:" + (ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown")
                    : "key:" + key.GetHashCode();

                return RateLimitPartition.GetSlidingWindowLimiter(partition, _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit          = 300,
                    Window               = TimeSpan.FromSeconds(60),
                    SegmentsPerWindow    = 6,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit           = 0,
                });
            });
        });
}
