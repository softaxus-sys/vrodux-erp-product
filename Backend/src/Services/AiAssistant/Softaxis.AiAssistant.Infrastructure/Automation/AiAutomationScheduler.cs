using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;

namespace Softaxis.AiAssistant.Infrastructure.Automation;

/// <summary>
/// Fires due automation rules across all tenants. Wakes on a fixed interval, finds rules whose
/// <c>NextRunAt</c> has passed (query filters bypassed — no ambient tenant on a background thread),
/// and runs each one through <see cref="IAiAutomationRunner"/>, which re-scopes the ambient tenant
/// per rule. Mirrors CRM's RawLeadInboxProcessor.
/// </summary>
public sealed class AiAutomationScheduler(
    IServiceScopeFactory scopeFactory,
    ILogger<AiAutomationScheduler> logger) : BackgroundService
{
    private const int BatchSize = 25;
    private static readonly TimeSpan Interval     = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(45);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await TickAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "AiAutomationScheduler: tick failed.");
            }

            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { break; }
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        // Find due rules with no ambient tenant (bypasses the global filter → sees all tenants).
        List<DueRule> rows;
        using (var scope = scopeFactory.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AiAssistantDbContext>();
            var now = DateTime.UtcNow;

            rows = await db.AutomationRules.IgnoreQueryFilters()
                .Where(r => r.Enabled && r.NextRunAt != null && r.NextRunAt <= now)
                .OrderBy(r => r.NextRunAt)
                .Take(BatchSize)
                .Select(r => new DueRule(r.Id, EF.Property<Guid?>(r, TenantIsolation.Column)))
                .ToListAsync(ct);
        }

        var due = rows.Where(x => x.TenantId != null)
                      .Select(x => (RuleId: x.Id, TenantId: x.TenantId!.Value))
                      .ToList();
        if (due.Count == 0) return;

        foreach (var (ruleId, tenantId) in due)
        {
            if (ct.IsCancellationRequested) break;

            // Fresh scope per rule so the ambient tenant + impersonation never leak across rules.
            using var scope = scopeFactory.CreateScope();
            var db     = scope.ServiceProvider.GetRequiredService<AiAssistantDbContext>();
            var runner = scope.ServiceProvider.GetRequiredService<IAiAutomationRunner>();

            TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
            try
            {
                var rule = await db.AutomationRules.FirstOrDefaultAsync(r => r.Id == ruleId, ct);
                if (rule is null || !rule.Enabled) continue;

                var run = await runner.RunAsync(rule, tenantId, "schedule", ct);
                logger.LogInformation(
                    "Automation {Rule} ({Name}) ran: {Status}.", rule.Id, rule.Name, run.Status);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "AiAutomationScheduler: rule {Rule} failed.", ruleId);
            }
            finally
            {
                TenantAmbient.Clear();
            }
        }
    }

    private sealed record DueRule(Guid Id, Guid? TenantId);
}
