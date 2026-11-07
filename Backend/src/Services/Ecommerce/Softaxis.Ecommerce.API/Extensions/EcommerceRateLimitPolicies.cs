using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Softaxis.Ecommerce.API.Extensions;

/// <summary>
/// Rate limits for the anonymous storefront. The gateway is the real host, so it must call
/// <see cref="AddEcommerceRateLimiting"/> — an [EnableRateLimiting] attribute naming a policy nobody registered throws on the first request.
/// </summary>
public static class EcommerceRateLimitPolicies
{
    /// <summary>Browsing: pages, products, pictures, the cart quote.</summary>
    public const string Browse = "shop_browse";
    /// <summary>Placing and paying for orders.</summary>
    public const string Checkout = "shop_checkout";
    /// <summary>Sign-in, sign-up, password reset: the endpoints a password can be guessed through.</summary>
    public const string Auth = "shop_auth";

    /// <param name="configuration">Optional. <c>Ecommerce:RateLimits:Browse|Checkout|Auth</c> (requests per minute per address) override the defaults.</param>
    public static IServiceCollection AddEcommerceRateLimiting(this IServiceCollection services, IConfiguration? configuration = null)
    {
        int Limit(string key, int fallback) => Math.Max(1, configuration?.GetValue<int?>("Ecommerce:RateLimits:" + key) ?? fallback);
        var browse = Limit("Browse", 600);        // a page of product pictures is dozens of requests
        var checkout = Limit("Checkout", 20);
        var auth = Limit("Auth", 20);
        return services.AddRateLimiter(rl =>
        {
            rl.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            rl.AddPolicy(Browse, ctx => PerAddress(ctx, "browse", permits: browse));
            rl.AddPolicy(Checkout, ctx => PerAddress(ctx, "checkout", permits: checkout));
            rl.AddPolicy(Auth, ctx => PerAddress(ctx, "auth", permits: auth));
        });
    }

    // Keyed by the connection's address, not a forwarded header: a header is the caller's to set.
    private static RateLimitPartition<string> PerAddress(HttpContext ctx, string bucket, int permits) =>
        RateLimitPartition.GetSlidingWindowLimiter(
            $"{bucket}:{ctx.Connection.RemoteIpAddress}",
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = permits, Window = TimeSpan.FromSeconds(60), SegmentsPerWindow = 6,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst, QueueLimit = 0,
            });
}
