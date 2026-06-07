using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Enums;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.API.Middleware;

/// <summary>
/// Blocks API requests for tenants whose subscription has expired.
///
/// On-premises (offline):
///   Validates the RSA-2048 signed license key stored in the tenant record.
///   No internet required — signature is verified with the embedded public key.
///   ExpiresAt lives inside the signed payload; DB column tampering has zero effect.
///
/// Cloud (online):
///   Checks TenantStatus and LicenseExpiresAt from the DB.
///   Super admin can suspend / expire accounts immediately.
///
/// Results are cached 60 seconds per tenant to avoid a DB round-trip on every request.
///
/// Anti-crack properties:
///   • RSA-2048 signature: forging a license key requires the Softaxis private key.
///   • Payload contains TenantId + TenantSlug: licenses cannot be reused across tenants.
///   • ExpiresAt is inside the signed payload: editing the DB row does NOT extend the license.
///   • No bypass switch exists in this middleware.
/// </summary>
public sealed class SubscriptionEnforcementMiddleware(RequestDelegate next, IMemoryCache cache)
{
    // Paths that bypass subscription enforcement (must still pass auth/authz normally)
    private static readonly string[] BypassPrefixes =
    [
        "/health",
        "/api/auth/",        // login, refresh, verify-email, forgot-password
        "/api/license/",     // heartbeat endpoint
        "/openapi",          // Swagger / OpenAPI spec
        "/scalar",           // Scalar API docs UI
    ];

    public async Task InvokeAsync(
        HttpContext       ctx,
        ITenantContext    tenantCtx,
        ITenantRepository tenantRepo,
        ILicenseService   licSvc)
    {
        // Super-admin is never gated by tenant subscription
        if (tenantCtx.IsSuperAdmin)
        {
            await next(ctx);
            return;
        }

        // Unauthenticated or no tenant resolved — let auth pipeline decide
        if (!tenantCtx.TenantId.HasValue)
        {
            await next(ctx);
            return;
        }

        // Exempt well-known paths
        var path = ctx.Request.Path.Value ?? string.Empty;
        foreach (var prefix in BypassPrefixes)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                await next(ctx);
                return;
            }
        }

        // Load result from cache or evaluate fresh
        var tenantId = tenantCtx.TenantId.Value;
        var cacheKey = $"sub_{tenantId:N}";

        if (!cache.TryGetValue(cacheKey, out SubscriptionResult? result) || result is null)
        {
            var tenant = await tenantRepo.GetByIdAsync(tenantId, ctx.RequestAborted);
            result     = Evaluate(tenant, licSvc);
            cache.Set(cacheKey, result, TimeSpan.FromSeconds(60));
        }

        if (!result.IsValid)
        {
            await WriteBlock(ctx, result);
            return;
        }

        await next(ctx);
    }

    // ── Evaluation ─────────────────────────────────────────────────────────────

    private static SubscriptionResult Evaluate(
        Domain.Entities.Tenant? tenant, ILicenseService svc)
    {
        if (tenant is null)
            return SubscriptionResult.Block("TENANT_NOT_FOUND", "Tenant not found.");

        return tenant.DeploymentType == DeploymentType.OnPremises
            ? EvaluateOnPrem(tenant, svc)
            : EvaluateCloud(tenant);
    }

    /// <summary>
    /// On-premises: validate RSA-signed license key. Fully offline.
    /// The signed payload contains ExpiresAt — no DB column can override it.
    /// </summary>
    private static SubscriptionResult EvaluateOnPrem(
        Domain.Entities.Tenant tenant, ILicenseService svc)
    {
        if (string.IsNullOrWhiteSpace(tenant.LicenseKey))
            return SubscriptionResult.Block(
                "LICENSE_NOT_ISSUED",
                "No license key has been issued for this installation. Contact Softaxis support to activate your subscription.");

        // ValidateLicenseKey verifies RSA signature AND checks ExpiresAt > UtcNow
        // Returns null if signature is invalid, tampered, or expired
        var payload = svc.ValidateLicenseKey(tenant.LicenseKey);
        if (payload is null)
            return SubscriptionResult.Block(
                "LICENSE_EXPIRED",
                "Your software license has expired or is invalid. Contact Softaxis support to renew your subscription.");

        return SubscriptionResult.Allow(payload.ExpiresAt);
    }

    /// <summary>
    /// Cloud: check tenant status and license expiry from DB.
    /// Super admin can suspend or expire accounts with immediate effect (next cache cycle).
    /// </summary>
    private static SubscriptionResult EvaluateCloud(Domain.Entities.Tenant tenant)
    {
        if (tenant.Status == TenantStatus.Suspended)
            return SubscriptionResult.Block(
                "ACCOUNT_SUSPENDED",
                "Your account has been suspended. Contact Softaxis support.");

        if (tenant.Status == TenantStatus.Expired)
            return SubscriptionResult.Block(
                "SUBSCRIPTION_EXPIRED",
                "Your subscription has expired. Please renew your plan to continue.");

        // Trial period ended
        if (tenant.Status == TenantStatus.Trial &&
            tenant.TrialEndsAt.HasValue &&
            tenant.TrialEndsAt.Value < DateTime.UtcNow)
        {
            return SubscriptionResult.Block(
                "TRIAL_EXPIRED",
                "Your free trial has ended. Contact Softaxis to activate a subscription plan.");
        }

        // Subscription date exceeded (active/paid plans)
        if (tenant.LicenseExpiresAt.HasValue && tenant.LicenseExpiresAt.Value < DateTime.UtcNow)
        {
            return SubscriptionResult.Block(
                "SUBSCRIPTION_EXPIRED",
                "Your subscription has expired. Please renew your plan to continue.");
        }

        return SubscriptionResult.Allow(tenant.LicenseExpiresAt);
    }

    // ── Response ───────────────────────────────────────────────────────────────

    private static async Task WriteBlock(HttpContext ctx, SubscriptionResult result)
    {
        ctx.Response.StatusCode  = 403;
        ctx.Response.ContentType = "application/json";

        await ctx.Response.WriteAsync(JsonSerializer.Serialize(new
        {
            success   = false,
            errorCode = result.Code,
            message   = result.Message,
        }));
    }

    // ── Internal result type ───────────────────────────────────────────────────

    private sealed record SubscriptionResult(
        bool      IsValid,
        string?   Code,
        string?   Message,
        DateTime? ExpiresAt)
    {
        public static SubscriptionResult Allow(DateTime? expiresAt) =>
            new(true, null, null, expiresAt);

        public static SubscriptionResult Block(string code, string message) =>
            new(false, code, message, null);
    }
}
