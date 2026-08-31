using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;

namespace Softaxis.Sales.API.Extensions;

/// <summary>
/// Rate-limit policies for Sales' anonymous customer-facing links.
///
/// Mirrors <c>Softaxis.Identity.API.Extensions.AuthRateLimitPolicies</c> and exists for the same
/// reason: Sales' controllers run in two processes — the standalone <c>Softaxis.Sales.API</c> and
/// the <c>Softaxis.ApiGateway</c> that loads them via <c>AddApplicationPart</c> — so a policy
/// registered inline in one host is silently inert in the other. Kept separate from the auth
/// policies rather than folded into them because a quotation link is not an auth endpoint, and
/// the two sets are owned by different services.
///
/// Registering these as a second <c>AddRateLimiter</c> call is safe: each call adds another
/// configure delegate over the same options, and the policy names are disjoint. Two calls
/// declaring the SAME name would throw at startup, which is exactly why each service owns its own.
/// </summary>
public static class PublicLinkRateLimitPolicies
{
    /// <summary>The tokenised quotation link a customer opens without signing in.</summary>
    public const string PublicQuotation = "public_quotation";

    public static IServiceCollection AddPublicLinkRateLimiting(this IServiceCollection services) =>
        services.AddRateLimiter(rl =>
        {
            rl.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Addressed purely by a secret in the URL, so this is the one anonymous surface worth
            // brute-forcing. Generous enough for a customer reloading and re-reading the quotation
            // they were sent, far too slow to walk a 24-byte token space.
            rl.AddPolicy(PublicQuotation, ctx =>
                RateLimitPartition.GetSlidingWindowLimiter(
                    // Behind a proxy this is the proxy's address unless forwarded headers are wired
                    // up. Deliberate: the alternative is trusting a client-supplied header, which
                    // an attacker can rotate at will.
                    partitionKey: ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    factory: _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit          = 60,
                        Window               = TimeSpan.FromSeconds(60),
                        SegmentsPerWindow    = 6,
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        QueueLimit           = 0,
                    }));
        });
}
