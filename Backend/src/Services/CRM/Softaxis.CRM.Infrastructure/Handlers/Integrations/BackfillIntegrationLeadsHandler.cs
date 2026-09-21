using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.Integrations.Dtos;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyPortals;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

/// <summary>
/// One-off history import for a provider that can serve a window (Bayut / dubizzle today).
///
/// <para>Runs inline rather than as a background job: the providers cap history at six months and
/// the volume that fits in that window is small — tens to low hundreds of leads — so the caller can
/// wait and, more usefully, be told exactly what happened. A queue would buy nothing but a status
/// screen to build.</para>
/// </summary>
internal sealed class BackfillIntegrationLeadsHandler(
    CrmDbContext db,
    ILeadProviderRegistry registry,
    ILeadIntakeService intake,
    ILogger<BackfillIntegrationLeadsHandler> logger)
    : ICommandHandler<BackfillIntegrationLeadsCommand, LeadBackfillResultDto>
{
    public async Task<Result<LeadBackfillResultDto>> Handle(BackfillIntegrationLeadsCommand cmd, CancellationToken ct)
    {
        var integration = await db.Integrations
            .Include(i => i.FieldMappings)
            .Include(i => i.Resources)
            .FirstOrDefaultAsync(i => i.Id == cmd.Id && !i.IsDeleted, ct);

        if (integration is null)
            return Result.Failure<LeadBackfillResultDto>(Error.NotFoundById("Integration", cmd.Id));

        // The leads must be filed against a real workspace. A super-admin session has no tenant, so
        // there is nowhere to put them — the same rule that governs connecting an integration.
        if (TenantAmbient.TenantId is not { } tenantId)
            return Result.Failure<LeadBackfillResultDto>(Error.Custom("Integration.Conflict",
                "Import history from a tenant account, not a super-admin session."));

        if (registry.Find(integration.ProviderKey) is not IBackfillLeadProvider provider)
            return Result.Failure<LeadBackfillResultDto>(Error.Custom("Integration.NotSupported",
                $"'{integration.ProviderKey}' cannot import history."));

        // Clamped here as well as in the provider so the caller is TOLD the date moved, rather than
        // silently getting a different window from the one they asked for.
        var since = cmd.Since;
        string? note = null;
        if (provider.MaxBackfillAge is { } max && since < DateTime.UtcNow - max)
        {
            since = DateTime.UtcNow - max;
            note = $"The provider serves at most {max.TotalDays:0} days of history, so the import starts at {since:yyyy-MM-dd}.";
        }

        // Every import is recorded, successful or not. Until now a failed backfill wrote nothing
        // anywhere, so the only trace of it was a 500 in the caller's browser and a stack trace in
        // the server log — Sync History showed the import had never been attempted.
        var log = new IntegrationSyncLog(integration.Id, trigger: "manual");
        db.Entry(log).Property(TenantIsolation.Column).CurrentValue = tenantId;
        db.IntegrationSyncLogs.Add(log);

        IReadOnlyList<CanonicalLead> leads;
        try
        {
            leads = await provider.FetchSinceAsync(integration, since, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // The fetch was the ONLY unguarded await in this handler, so anything the portal threw —
            // a rejected key, an unreachable host, a timeout — escaped as an opaque
            // "An unexpected error occurred." 500. The reason was always known; it was simply
            // never passed on to the person who could act on it.
            var (code, message) = DescribeFetchFailure(ex, integration.ProviderKey);
            log.Fail(message);
            await db.SaveChangesAsync(ct);

            logger.LogError(ex, "Backfill: {Provider} history import failed for tenant {Tenant}.",
                integration.ProviderKey, tenantId);

            // Health is deliberately NOT changed. This is a one-off action someone took by hand;
            // the scheduled poll decides whether the integration is broken, and flipping it into
            // Error here would also start its retry backoff and fire an outage alert off a single
            // button press.
            return Result.Failure<LeadBackfillResultDto>(Error.Custom(code, message));
        }

        var created = 0; var duplicates = 0; var failed = 0;
        foreach (var lead in leads)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                var outcome = await intake.IngestAsync(lead, tenantId, integration, ct);
                switch (outcome.Outcome)
                {
                    case IntakeOutcome.Created:
                    case IntakeOutcome.Updated:   created++;    break;
                    case IntakeOutcome.Duplicate: duplicates++; break;
                    default:                      failed++;     break;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // One malformed lead must not cost the whole import — the rest are still worth having.
                failed++;
                logger.LogWarning(ex, "Backfill: a {Provider} lead could not be ingested.", integration.ProviderKey);
            }
        }

        log.Complete(leads.Count, created, duplicates, failed,
            leads.Count == 0 ? $"No {integration.ProviderKey} leads in the requested window." : null);
        await db.SaveChangesAsync(ct);

        // Deliberately NOT RecordSyncSuccess: that moves the poll's watermark forward, and a
        // backfill reaching into the past says nothing about what has arrived since.
        logger.LogInformation(
            "Backfill: {Provider} fetched {Fetched}, created {Created}, {Duplicates} already present, {Failed} failed.",
            integration.ProviderKey, leads.Count, created, duplicates, failed);

        return Result.Success(new LeadBackfillResultDto(leads.Count, created, duplicates, failed, since, note));
    }

    /// <summary>
    /// Turns a provider exception into an error code the API can map to a real status, and a
    /// message that names what the caller has to do about it.
    /// </summary>
    /// <remarks>
    /// The distinction that matters is <b>can this recover on its own?</b> A rejected or missing
    /// key cannot — someone has to re-enter it — so saying "try again later" would leave them
    /// waiting on something that will never happen. Everything else is the portal having a bad
    /// moment, and retrying is exactly the right advice.
    /// </remarks>
    private static (string Code, string Message) DescribeFetchFailure(Exception ex, string providerKey) =>
        ex switch
        {
            PortalPullConfigurationException c =>
                ("Integration.Conflict", c.Message),

            PortalPullException p =>
                ("Integration.Unavailable", p.Message),

            TaskCanceledException =>
                ("Integration.Unavailable",
                 $"{providerKey} did not respond in time. Import a shorter window, or try again shortly."),

            HttpRequestException h =>
                ("Integration.Unavailable",
                 $"Could not reach {providerKey}: {(h.InnerException ?? h).Message}"),

            _ => ("Integration.Unavailable",
                  $"The {providerKey} import failed: {ex.Message}"),
        };
}
