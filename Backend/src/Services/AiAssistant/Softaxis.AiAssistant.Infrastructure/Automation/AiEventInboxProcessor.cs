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
/// Drains the AI event inbox (M4b) across all tenants: for each stored event, runs every enabled
/// event-trigger rule whose <c>EventKey</c> matches, via <see cref="IAiAutomationRunner"/> (same path as
/// scheduled rules). Failed rows retry with backoff. Mirrors CRM's RawLeadInboxProcessor and the
/// scheduled-rule <see cref="AiAutomationScheduler"/>.
/// </summary>
public sealed class AiEventInboxProcessor(
    IServiceScopeFactory scopeFactory,
    ILogger<AiEventInboxProcessor> logger) : BackgroundService
{
    private const int MaxAttempts = 4;
    private const int BatchSize   = 25;
    private static readonly TimeSpan Interval     = TimeSpan.FromSeconds(20);
    private static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(40);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await TickAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "AiEventInboxProcessor: tick failed.");
            }

            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { break; }
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        List<PendingRow> rows;
        using (var scope = scopeFactory.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AiAssistantDbContext>();
            var now = DateTime.UtcNow;
            rows = await db.EventInbox.IgnoreQueryFilters()
                .Where(x => x.Status == "pending" && (x.NextAttemptAt == null || x.NextAttemptAt <= now))
                .OrderBy(x => x.ReceivedAt)
                .Take(BatchSize)
                .Select(x => new PendingRow(x.Id, EF.Property<Guid?>(x, TenantIsolation.Column)))
                .ToListAsync(ct);
        }

        var due = rows.Where(x => x.TenantId != null).ToList();
        if (due.Count == 0) return;

        foreach (var row in due)
        {
            if (ct.IsCancellationRequested) break;
            var tenantId = row.TenantId!.Value;

            using var scope = scopeFactory.CreateScope();
            var db      = scope.ServiceProvider.GetRequiredService<AiAssistantDbContext>();
            var runner  = scope.ServiceProvider.GetRequiredService<IAiAutomationRunner>();
            var voice   = scope.ServiceProvider.GetRequiredService<Voice.VoiceCallScheduler>();

            TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
            try
            {
                await ProcessRowAsync(db, runner, voice, row.Id, tenantId, ct);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "AiEventInboxProcessor: row {Row} failed.", row.Id);
                var evt = await db.EventInbox.FirstOrDefaultAsync(x => x.Id == row.Id, ct);
                if (evt is not null) { evt.MarkFailed(ex.Message, MaxAttempts); await db.SaveChangesAsync(ct); }
            }
            finally
            {
                TenantAmbient.Clear();
            }
        }
    }

    private async Task ProcessRowAsync(
        AiAssistantDbContext db, IAiAutomationRunner runner, Voice.VoiceCallScheduler voice,
        Guid rowId, Guid tenantId, CancellationToken ct)
    {
        var evt = await db.EventInbox.FirstOrDefaultAsync(x => x.Id == rowId, ct);
        if (evt is null) return;

        evt.MarkProcessing();
        await db.SaveChangesAsync(ct);

        // Voice agent (M1): a new lead may also schedule an outbound AI call. Best-effort — the
        // scheduler dedupes per lead, so an inbox retry can't double-book a call.
        try
        {
            await voice.TryScheduleForEventAsync(evt, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Voice: scheduling for event {Event} failed.", evt.Id);
        }

        var rules = await db.AutomationRules
            .Where(r => r.Enabled && r.TriggerType == "event" && r.EventKey == evt.EventKey)
            .ToListAsync(ct);

        var context = BuildTriggerContext(evt.EventKey, evt.Title, evt.PayloadJson);

        var fired = 0;
        foreach (var rule in rules)
        {
            try
            {
                await runner.RunAsync(rule, tenantId, "event", ct, context);
                fired++;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "AiEventInboxProcessor: rule {Rule} failed for event {Event}.", rule.Id, evt.EventKey);
            }
        }

        evt.MarkProcessed(fired);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Event {Event} fired {Count} rule(s) for tenant {Tenant}.", evt.EventKey, fired, tenantId);
    }

    private static string BuildTriggerContext(string eventKey, string? title, string? payloadJson)
    {
        var titlePart = string.IsNullOrWhiteSpace(title) ? "" : $" ({title})";
        var dataPart  = string.IsNullOrWhiteSpace(payloadJson) ? "" : $" Event data: {payloadJson}.";
        return $"[This run was triggered by the business event '{eventKey}'{titlePart}.{dataPart} " +
               "Act specifically on this event.]";
    }

    private sealed record PendingRow(Guid Id, Guid? TenantId);
}
