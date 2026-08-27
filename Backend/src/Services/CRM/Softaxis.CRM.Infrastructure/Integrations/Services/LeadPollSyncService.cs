using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Integrations.Services;

/// <summary>
/// Pulls leads on a schedule for every connected integration whose provider supports it
/// (<see cref="IPollSyncLeadProvider"/>).
///
/// <para><b>This is a safety net, not the delivery mechanism.</b> Webhooks are how leads normally
/// arrive — instantly, and without burning API quota. But a webhook delivered while the gateway is
/// restarting is gone: the provider retries for a while and then gives up, and nothing in the
/// system would ever know a lead was missed. Polling closes that hole by periodically asking "what
/// has appeared since we last succeeded?".</para>
///
/// <para>Dedupe is what makes it safe to overlap with the webhook: a lead already ingested comes
/// back as a duplicate and is skipped, so the two paths cannot create the same lead twice.</para>
///
/// <para>Deliberately infrequent. Every cycle costs provider API calls against a rate limit shared
/// with the interactive import screens, so it runs on the hour scale rather than the minute scale —
/// anything more aggressive would be paying real quota to catch a rare failure.</para>
/// </summary>
public sealed class LeadPollSyncService(
    IServiceScopeFactory scopeFactory,
    ILogger<LeadPollSyncService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(30);

    /// <summary>
    /// Long on purpose. Every MigrateAndSeed runs before the host starts serving, and the deploy's
    /// health window is unforgiving — a poll firing into a half-warmed process would compete with
    /// startup for connections and could delay /health.
    /// </summary>
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(3);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await PollAllAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Never let one bad integration take the loop down — it would silently stop
                // gap-filling for every tenant.
                logger.LogError(ex, "LeadPollSyncService: cycle failed.");
            }

            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { break; }
        }
    }

    private async Task PollAllAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db       = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
        var registry = scope.ServiceProvider.GetRequiredService<ILeadProviderRegistry>();
        var intake   = scope.ServiceProvider.GetRequiredService<ILeadIntakeService>();

        // No ambient tenant here, so this sees every tenant's integrations — the tenant is then
        // set per integration before anything is written.
        var integrations = await db.Integrations
            .Include(i => i.FieldMappings)
            .Include(i => i.Resources)
            .Where(i => !i.IsDeleted && i.Status == IntegrationStatus.Connected)
            .ToListAsync(ct);

        foreach (var integration in integrations)
        {
            ct.ThrowIfCancellationRequested();

            if (registry.Find(integration.ProviderKey) is not IPollSyncLeadProvider provider) continue;

            var tenantId = (Guid?)db.Entry(integration).Property(TenantIsolation.Column).CurrentValue;
            if (tenantId is null)
            {
                logger.LogWarning("LeadPollSyncService: integration {Id} has no tenant; skipped.", integration.Id);
                continue;
            }

            try
            {
                var leads = await provider.FetchAsync(integration, ct);
                if (leads.Count == 0)
                {
                    // Still a success: "nothing new" is the normal answer, and recording it keeps
                    // the next window from re-scanning ground already covered.
                    integration.RecordSyncSuccess();
                    await db.SaveChangesAsync(ct);
                    continue;
                }

                var created = 0; var duplicates = 0; var failed = 0;
                foreach (var lead in leads)
                {
                    try
                    {
                        var outcome = await intake.IngestAsync(lead, tenantId.Value, integration, ct);
                        switch (outcome.Outcome)
                        {
                            case IntakeOutcome.Created:   created++;    break;
                            // Counted with created: the poll caught a real contact the webhook
                            // missed, which is exactly what this service exists to report.
                            case IntakeOutcome.Updated:   created++;    break;
                            case IntakeOutcome.Duplicate: duplicates++; break;
                            default:                      failed++;     break;
                        }
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        failed++;
                        logger.LogWarning(ex, "LeadPollSyncService: a lead from {Provider} could not be ingested.",
                            integration.ProviderKey);
                    }
                }

                integration.RecordSyncSuccess();
                await db.SaveChangesAsync(ct);

                // Only worth a log line when the poll actually caught something the webhook missed.
                if (created > 0)
                    logger.LogInformation(
                        "LeadPollSyncService: {Provider} gap-fill created {Created} lead(s) " +
                        "({Duplicates} already present, {Failed} failed) for tenant {Tenant}.",
                        integration.ProviderKey, created, duplicates, failed, tenantId);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                integration.RecordSyncFailure(ex.Message);
                await db.SaveChangesAsync(ct);
                logger.LogError(ex, "LeadPollSyncService: {Provider} poll failed for tenant {Tenant}.",
                    integration.ProviderKey, tenantId);
            }
        }
    }
}
