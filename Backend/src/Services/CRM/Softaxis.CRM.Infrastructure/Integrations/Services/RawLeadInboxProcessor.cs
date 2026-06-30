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
/// Drains <see cref="RawLeadInbox"/> across all tenants: normalizes each stored payload via its
/// provider and runs every resulting lead through the intake pipeline. Failed rows are retried
/// with exponential backoff up to <see cref="MaxAttempts"/>. Runs with an unresolved ambient
/// tenant (so it sees all rows) and sets the ambient tenant per row before processing.
/// </summary>
public sealed class RawLeadInboxProcessor(
    IServiceScopeFactory scopeFactory,
    ILogger<RawLeadInboxProcessor> logger) : BackgroundService
{
    private const int MaxAttempts = 5;
    private const int BatchSize   = 50;
    private static readonly TimeSpan Interval     = TimeSpan.FromSeconds(20);
    private static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await ProcessBatchAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "RawLeadInboxProcessor: batch failed.");
            }

            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { break; }
        }
    }

    private async Task ProcessBatchAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db       = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
        var registry = scope.ServiceProvider.GetRequiredService<ILeadProviderRegistry>();
        var intake   = scope.ServiceProvider.GetRequiredService<ILeadIntakeService>();

        var now = DateTime.UtcNow;
        var pending = await db.RawLeadInbox
            .Where(x => x.Status == RawLeadStatus.Pending && (x.NextAttemptAt == null || x.NextAttemptAt <= now))
            .OrderBy(x => x.ReceivedAt)
            .Take(BatchSize)
            .ToListAsync(ct);

        if (pending.Count == 0) return;

        foreach (var row in pending)
        {
            var tenantId = (Guid?)db.Entry(row).Property(TenantIsolation.Column).CurrentValue;
            row.MarkProcessing();
            await db.SaveChangesAsync(ct);

            if (tenantId is null)
            {
                row.MarkFailed("Inbox row has no tenant.", MaxAttempts);
                await db.SaveChangesAsync(ct);
                continue;
            }

            // Scope all subsequent reads/writes to the row's tenant.
            TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
            try
            {
                await ProcessRowAsync(db, registry, intake, row, tenantId.Value, ct);
            }
            catch (Exception ex)
            {
                row.MarkFailed(ex.Message, MaxAttempts);
                logger.LogWarning(ex, "RawLeadInboxProcessor: row {Row} failed (attempt {Attempt}).", row.Id, row.Attempts);
                await db.SaveChangesAsync(ct);
            }
            finally
            {
                TenantAmbient.Clear();
            }
        }
    }

    private async Task ProcessRowAsync(
        CrmDbContext db, ILeadProviderRegistry registry, ILeadIntakeService intake,
        RawLeadInbox row, Guid tenantId, CancellationToken ct)
    {
        var integration = await db.Integrations
            .Include(x => x.FieldMappings)
            .Include(x => x.Resources)
            .FirstOrDefaultAsync(x => x.Id == row.IntegrationId, ct);

        if (integration is null)
        {
            row.MarkFailed("Integration no longer exists.", MaxAttempts);
            await db.SaveChangesAsync(ct);
            return;
        }

        var log = new IntegrationSyncLog(integration.Id, trigger: "webhook");
        db.Entry(log).Property(TenantIsolation.Column).CurrentValue = tenantId;
        db.IntegrationSyncLogs.Add(log);

        var provider = registry.Find(integration.ProviderKey);
        var leads = provider is IAsyncLeadProvider asyncProvider
            ? await asyncProvider.NormalizeAsync(row.Payload, integration, ct)
            : provider?.Normalize(row.Payload, integration) ?? [];

        if (leads.Count == 0)
        {
            row.MarkFailed("Payload produced no leads.", MaxAttempts);
            log.Fail("Payload produced no leads.");
            integration.RecordSyncFailure("Payload produced no leads.");
            await db.SaveChangesAsync(ct);
            return;
        }

        int created = 0, duplicates = 0, failed = 0;
        Guid? firstLeadId = null, firstDuplicateId = null;

        foreach (var lead in leads)
        {
            var result = await intake.IngestAsync(lead, tenantId, integration, ct);
            switch (result.Outcome)
            {
                case IntakeOutcome.Created:   created++; firstLeadId ??= result.LeadId; break;
                case IntakeOutcome.Duplicate: duplicates++; firstDuplicateId ??= result.LeadId; break;
                default:                      failed++; break;
            }
        }

        log.Complete(leads.Count, created, duplicates, failed);

        if (created > 0)        row.MarkProcessed(firstLeadId);
        else if (duplicates > 0) row.MarkDuplicate(firstDuplicateId);
        else                    row.MarkFailed("All leads rejected.", MaxAttempts);

        if (failed == leads.Count) integration.RecordSyncFailure("All leads rejected.");
        else                       integration.RecordSyncSuccess();

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Inbox row {Row}: created={Created} dup={Dup} failed={Failed}.", row.Id, created, duplicates, failed);
    }
}
