using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.Integrations.Dtos;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Dtos;
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

        var leads = await provider.FetchSinceAsync(integration, since, ct);

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

        // Deliberately NOT RecordSyncSuccess: that moves the poll's watermark forward, and a
        // backfill reaching into the past says nothing about what has arrived since.
        logger.LogInformation(
            "Backfill: {Provider} fetched {Fetched}, created {Created}, {Duplicates} already present, {Failed} failed.",
            integration.ProviderKey, leads.Count, created, duplicates, failed);

        return Result.Success(new LeadBackfillResultDto(leads.Count, created, duplicates, failed, since, note));
    }
}
