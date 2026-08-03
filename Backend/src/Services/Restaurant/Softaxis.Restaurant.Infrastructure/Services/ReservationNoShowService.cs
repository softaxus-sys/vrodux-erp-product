using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Services;

/// <summary>
/// Periodic background job that auto-flags confirmed reservations as "no_show" once they're
/// past their branch's ReservationRule.AutoNoShowMinutes grace window. A tenant/branch with no
/// ReservationRule row configured never gets auto-flagged (opt-in via Settings, not a silent
/// default) — AutoNoShowMinutes &lt;= 0 also disables it explicitly.
/// </summary>
public sealed class ReservationNoShowService(
    IServiceScopeFactory scopeFactory,
    ILogger<ReservationNoShowService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<RestaurantDbContext>();
                var flagged = await RunOnceAsync(db, DateTime.UtcNow, stoppingToken);
                if (flagged > 0)
                    logger.LogInformation("ReservationNoShow: flagged {Count} reservation(s) as no-show.", flagged);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "ReservationNoShow: run failed.");
            }

            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { break; }
        }
    }

    /// <summary>Runs one sweep across ALL tenants (no ambient tenant in a background context —
    /// same pattern as the other startup/background repair jobs in this codebase).</summary>
    internal static async Task<int> RunOnceAsync(RestaurantDbContext db, DateTime nowUtc, CancellationToken ct)
    {
        var candidates = await db.Reservations.IgnoreQueryFilters()
            .Where(r => !r.IsDeleted && r.Status == "confirmed")
            .ToListAsync(ct);
        if (candidates.Count == 0) return 0;

        var rules = await db.ReservationRules.IgnoreQueryFilters()
            .Where(r => !r.IsDeleted)
            .ToListAsync(ct);

        var rulesByTenant = rules
            .Select(r => (Rule: r, TenantId: db.Entry(r).Property<Guid?>(TenantIsolation.Column).CurrentValue))
            .Where(x => x.TenantId is not null)
            .GroupBy(x => x.TenantId!.Value)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Rule).ToList());

        var flagged = 0;
        foreach (var r in candidates)
        {
            var tenantId = db.Entry(r).Property<Guid?>(TenantIsolation.Column).CurrentValue;
            if (tenantId is null || !rulesByTenant.TryGetValue(tenantId.Value, out var tenantRules)) continue;

            var rule = tenantRules.FirstOrDefault(x => x.BranchId == r.BranchId)
                       ?? tenantRules.FirstOrDefault(x => x.BranchId is null);
            if (rule is null || rule.AutoNoShowMinutes <= 0) continue;

            var effectiveTime = r.ArrivalWindowEnd ?? r.ReservationTime;
            if (!DateTime.TryParseExact($"{r.ReservationDate} {effectiveTime}", "yyyy-MM-dd HH:mm",
                    null, System.Globalization.DateTimeStyles.None, out var reservedAt))
                continue;

            if (nowUtc >= reservedAt.AddMinutes(rule.AutoNoShowMinutes))
            {
                r.NoShow();
                flagged++;
            }
        }

        if (flagged > 0) await db.SaveChangesAsync(ct);
        return flagged;
    }
}
