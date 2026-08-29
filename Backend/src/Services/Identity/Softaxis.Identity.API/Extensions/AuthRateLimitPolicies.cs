using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;

namespace Softaxis.Identity.API.Extensions;

/// <summary>
/// Rate-limit policies for the anonymous auth endpoints.
/// <para>
/// Lives here, not inline in a host, because Identity's controllers run in TWO processes: the
/// standalone <c>Softaxis.Identity.API</c> and the <c>Softaxis.ApiGateway</c> that loads them via
/// <c>AddApplicationPart</c>. The gateway previously registered none of this, so every
/// <c>[EnableRateLimiting]</c> attribute on those endpoints was silently inert in the deployment
/// that actually serves customers — a limit that exists in source and not in production is worse
/// than none, because nobody goes looking for it.
/// </para>
/// </summary>
public static class AuthRateLimitPolicies
{
    /// <summary>Bulk token harvesting on the trial challenge.</summary>
    public const string TrialChallenge = "trial_challenge";
    /// <summary>Automated sign-up abuse.</summary>
    public const string TrialRegister = "trial_register";
    /// <summary>Password-reset and resend-verification mail spam.</summary>
    public const string ForgotPassword = "forgot_password";
    /// <summary>Redeeming a reset token. Separate from ForgotPassword so a burst of reset
    /// REQUESTS cannot use up the budget someone else needs to COMPLETE their reset.</summary>
    public const string ResetPassword = "reset_password";

    public static IServiceCollection AddAuthRateLimiting(this IServiceCollection services) =>
        services.AddRateLimiter(rl =>
        {
            rl.RejectionStatusCode = 429;

            Add(rl, TrialChallenge, permitLimit:  5, seconds:  60, segments: 6);
            Add(rl, TrialRegister,  permitLimit:  3, seconds: 300, segments: 5);

            // Per IP, and an office shares one: 5 was low enough that a handful of colleagues
            // resetting on the same morning would lock the rest out. Enumeration is no longer what
            // this defends against — forgot-password answers identically for every address — so it
            // can be loose enough not to punish a normal workplace while still stopping a flood.
            Add(rl, ForgotPassword, permitLimit: 20, seconds: 300, segments: 5);

            // The token is 64 random bytes, so this is not guarding against guessing; it caps the
            // damage a script can do hammering the endpoint.
            Add(rl, ResetPassword,  permitLimit: 20, seconds: 300, segments: 5);
        });

    private static void Add(RateLimiterOptions rl, string name, int permitLimit, int seconds, int segments) =>
        rl.AddPolicy(name, ctx =>
            RateLimitPartition.GetSlidingWindowLimiter(
                // Behind a proxy this is the proxy's address unless forwarded headers are wired up,
                // in which case every caller shares one partition. Deliberate: the alternative is
                // trusting a client-supplied header, which any attacker can rotate at will.
                partitionKey: ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit          = permitLimit,
                    Window               = TimeSpan.FromSeconds(seconds),
                    SegmentsPerWindow    = segments,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    QueueLimit           = 0,
                }));
}
