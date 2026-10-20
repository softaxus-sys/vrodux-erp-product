using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.LeadGen.Domain.Entities;
using Softaxis.LeadGen.Infrastructure.Persistence;

namespace Softaxis.LeadGen.Infrastructure.Services;

public sealed record TenantInfo(string Name, string Status);

/// <summary>
/// Reads the workspace's name and subscription state straight from the Identity schema. Both live
/// in the same database; a read-only query is far simpler and more robust than a service call, and
/// background workers have no request token to read a claim from. Cached briefly.
/// </summary>
public interface ITenantInfoReader
{
    Task<TenantInfo?> GetAsync(Guid tenantId, CancellationToken ct);
}

internal sealed class TenantInfoReader(LeadGenDbContext db, IMemoryCache cache) : ITenantInfoReader
{
    private sealed record Row(string Name, string Status);

    public async Task<TenantInfo?> GetAsync(Guid tenantId, CancellationToken ct)
    {
        var key = $"leadgen:tenant:{tenantId}";
        if (cache.TryGetValue(key, out TenantInfo? hit)) return hit;

        var row = (await db.Database
            .SqlQuery<Row>($"SELECT [Name] AS [Name], [Status] AS [Status] FROM [identity].[tenants] WHERE [Id] = {tenantId} AND [IsDeleted] = 0")
            .ToListAsync(ct)).FirstOrDefault();

        var info = row is null ? null : new TenantInfo(row.Name, row.Status);
        cache.Set(key, info, TimeSpan.FromMinutes(5));
        return info;
    }
}

public sealed record PolicyResult(bool Ok, string? Reason, bool SenderIdentityReady);

/// <summary>
/// The gate in front of every outgoing email. Sending is the one action here that can hurt someone
/// outside the workspace (a recipient) and the platform (our provider reputation), so it is held to
/// rules that searching and revealing are not.
/// </summary>
public interface IOutreachPolicy
{
    Task<PolicyResult> CanSendAsync(CancellationToken ct);
}

internal sealed class OutreachPolicy(
    LeadGenDbContext db, IPlatformSettings settings, ITenantInfoReader tenants, IProfileDefaults defaults) : IOutreachPolicy
{
    public async Task<PolicyResult> CanSendAsync(CancellationToken ct)
    {
        var cfg = await settings.GetAsync(ct);
        var profile = await defaults.EnsureAsync(ct);
        var identityReady = !string.IsNullOrWhiteSpace(profile?.SenderBusinessName) && !string.IsNullOrWhiteSpace(profile?.SenderAddress);

        if (!cfg.Enabled) return new(false, "Lead generation is switched off on this platform.", identityReady);

        if (cfg.RequireSenderIdentity && !identityReady)
            return new(false, "Add your business name and postal address in Settings. Every cold email must carry them.", identityReady);

        if (cfg.BlockSendingOnTrial && TenantAmbient.TenantId is { } tenantId)
        {
            var info = await tenants.GetAsync(tenantId, ct);
            if (info is not null && string.Equals(info.Status, "Trial", StringComparison.OrdinalIgnoreCase)
                && !await db.Purchases.AnyAsync(p => p.Status == PurchaseStatus.Paid, ct))
                return new(false, "Sending is unlocked once you buy credits or subscribe. This keeps the platform free of spam.", identityReady);
        }
        if (TenantAmbient.TenantId is { } t2)
        {
            var info = await tenants.GetAsync(t2, ct);
            if (info is not null && info.Status is "Suspended" or "Expired")
                return new(false, "Your subscription is not active.", identityReady);
        }
        return new(true, null, identityReady);
    }
}
