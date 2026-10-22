using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Integrations.Providers.Meta;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Integrations.Services;

/// <summary>The wire shape of one event, shared by the sender and the "send a test event" button.</summary>
internal static class MetaConversionPayload
{
    /// <summary>Names the source system to Meta ("lead_event_source" is the CRM's name in Meta's CRM integration).</summary>
    public const string LeadEventSource = "Vrodux";

    public static JsonObject ToEvent(MetaConversionEvent e)
    {
        var custom = new JsonObject { ["event_source"] = "crm", ["lead_event_source"] = LeadEventSource };
        // A value with no currency is rejected by Meta, so one is never sent without the other.
        if (e.Value is { } v && !string.IsNullOrWhiteSpace(e.Currency))
        {
            custom["value"] = v;
            custom["currency"] = e.Currency!.ToUpperInvariant();
        }

        return new JsonObject
        {
            ["event_name"]    = e.EventName,
            ["event_time"]    = new DateTimeOffset(DateTime.SpecifyKind(e.EventTime, DateTimeKind.Utc)).ToUnixTimeSeconds(),
            // Meta de-duplicates on event_id + event_name, so a retry after an ambiguous failure cannot count twice.
            ["event_id"]      = e.Id.ToString("N"),
            ["action_source"] = "system_generated",
            ["custom_data"]   = custom,
            ["user_data"]     = JsonNode.Parse(e.UserDataJson),
        };
    }
}

/// <summary>
/// Sends the queued lead-stage events to Meta. Runs across all tenants (ambient tenant unresolved so it
/// sees every row) and scopes itself to one tenant per integration while it works.
///
/// <para>Failures never lose an event: a temporary problem (Meta busy, network) backs off and retries,
/// a permanent one (bad token, wrong dataset) is shown as failed with Meta's own reason and can be
/// re-queued from the screen once fixed. Delayed start, like the other CRM workers, so it never holds
/// up the deploy's health check.</para>
/// </summary>
public sealed class MetaConversionSender(
    IServiceScopeFactory scopeFactory, ILogger<MetaConversionSender> logger) : BackgroundService
{
    private const int BatchSize = 500;
    private const int ChunkSize = 200;
    private static readonly TimeSpan Interval     = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(3);
    private static readonly TimeSpan SentRetention = TimeSpan.FromDays(90);

    private DateTime _lastPrune = DateTime.MinValue;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await ProcessBatchAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "MetaConversionSender: pass failed.");
            }

            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { break; }
        }
    }

    private async Task ProcessBatchAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db        = scope.ServiceProvider.GetRequiredService<CrmDbContext>();
        var client    = scope.ServiceProvider.GetRequiredService<MetaConversionsClient>();
        var protector = scope.ServiceProvider.GetRequiredService<ISecretProtector>();

        await PruneAsync(db, ct);

        var now = DateTime.UtcNow;
        var pending = await db.MetaConversionEvents
            .Where(e => e.Status == MetaConversionStatus.Pending && (e.NextAttemptAt == null || e.NextAttemptAt <= now))
            .OrderBy(e => e.CreatedAt)
            .Take(BatchSize)
            .ToListAsync(ct);
        if (pending.Count == 0) return;

        foreach (var group in pending.GroupBy(e => e.IntegrationId))
        {
            var tenantId = (Guid?)db.Entry(group.First()).Property(TenantIsolation.Column).CurrentValue;
            if (tenantId is null)
            {
                foreach (var e in group) e.MarkFailed("Event has no tenant.");
                await db.SaveChangesAsync(ct);
                continue;
            }

            TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
            try { await SendGroupAsync(db, client, protector, group.Key, group.ToList(), ct); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Leave the events pending: nothing was lost, and the next pass tries again.
                logger.LogError(ex, "MetaConversionSender: integration {Integration} failed unexpectedly.", group.Key);
            }
            finally { TenantAmbient.Clear(); }
        }
    }

    private async Task SendGroupAsync(
        CrmDbContext db, MetaConversionsClient client, ISecretProtector protector,
        Guid integrationId, List<MetaConversionEvent> events, CancellationToken ct)
    {
        var settings = await db.MetaConversionSettings.FirstOrDefaultAsync(s => s.IntegrationId == integrationId, ct);
        if (settings is null || !settings.IsReady)
        {
            // Turned off (or never finished) after these were queued. Not an error, and not worth retrying
            // for ever — the reason is on each row so it is clear why nothing reached Meta.
            foreach (var e in events) e.MarkSkipped("Sending to Meta was turned off or not fully set up.");
            await db.SaveChangesAsync(ct);
            return;
        }

        var token = protector.Unprotect(settings.AccessToken);
        if (string.IsNullOrWhiteSpace(token))
        {
            foreach (var e in events) e.MarkFailed("The saved access token could not be read. Paste it in again.");
            settings.RecordFailure("The saved access token could not be read. Paste it in again.");
            await db.SaveChangesAsync(ct);
            return;
        }

        foreach (var chunk in events.Chunk(ChunkSize))
        {
            var result = await client.SendAsync(settings.DatasetId!, token, chunk.Select(MetaConversionPayload.ToEvent).ToList(), null, ct);
            if (result.Ok)
            {
                foreach (var e in chunk) e.MarkSent();
                settings.RecordSent();
            }
            else
            {
                foreach (var e in chunk)
                {
                    if (result.Transient) e.ScheduleRetry(result.Error!);
                    else e.MarkFailed(result.Error!);
                }
                settings.RecordFailure(result.Error!);
            }
            await db.SaveChangesAsync(ct);
        }
    }

    /// <summary>Sent events are history, not state — keep a quarter of it so the table does not grow for ever.</summary>
    private async Task PruneAsync(CrmDbContext db, CancellationToken ct)
    {
        if (DateTime.UtcNow - _lastPrune < TimeSpan.FromHours(6)) return;
        _lastPrune = DateTime.UtcNow;
        var cutoff = DateTime.UtcNow - SentRetention;
        var removed = await db.MetaConversionEvents
            .Where(e => e.Status == MetaConversionStatus.Sent && e.SentAt != null && e.SentAt < cutoff)
            .ExecuteDeleteAsync(ct);
        if (removed > 0) logger.LogInformation("MetaConversionSender: pruned {Count} sent events older than {Days} days.", removed, SentRetention.TotalDays);
    }
}
