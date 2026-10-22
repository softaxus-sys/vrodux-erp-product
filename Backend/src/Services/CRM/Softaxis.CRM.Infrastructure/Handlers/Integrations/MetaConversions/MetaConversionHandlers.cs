using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.MetaConversions;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Integrations.Providers.Meta;
using Softaxis.CRM.Infrastructure.Integrations.Services;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations.MetaConversions;

internal static class MetaConversionSupport
{
    /// <summary>The Meta integration this belongs to, or why not. Other providers have no such link.</summary>
    public static async Task<Result<Integration>> MetaIntegrationAsync(CrmDbContext db, Guid id, CancellationToken ct)
    {
        var integration = await db.Integrations.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted, ct);
        if (integration is null) return Result.Failure<Integration>(Error.NotFoundById("Integration", id));
        if (!string.Equals(integration.ProviderKey, "meta", StringComparison.OrdinalIgnoreCase))
            return Result.Failure<Integration>(Error.Custom("Integration.NotSupported", "Lead quality reporting is only available for Meta."));
        return Result.Success(integration);
    }

    public static async Task<MetaConversionsDto> ToDtoAsync(
        CrmDbContext db, Guid integrationId, MetaConversionSettings? s, CancellationToken ct)
    {
        var counts = await db.MetaConversionEvents.AsNoTracking()
            .Where(e => e.IntegrationId == integrationId)
            .GroupBy(e => e.Status)
            .Select(g => new { Status = g.Key, N = g.Count() })
            .ToListAsync(ct);
        int Count(string st) => counts.FirstOrDefault(c => c.Status == st)?.N ?? 0;

        var weekAgo = DateTime.UtcNow.AddDays(-7);
        var sentWeek = await db.MetaConversionEvents.AsNoTracking()
            .CountAsync(e => e.IntegrationId == integrationId && e.Status == MetaConversionStatus.Sent && e.SentAt >= weekAgo, ct);

        var metaLeads = await db.LeadSources.AsNoTracking()
            .Where(x => x.IntegrationId == integrationId && x.ProviderKey == "meta" && x.ExternalLeadId != null)
            .Select(x => x.LeadId).Distinct().CountAsync(ct);

        // A row that does not exist yet reads exactly like a fresh one, so the screen needs no special case.
        var blank = s ?? new MetaConversionSettings(integrationId);
        return new MetaConversionsDto(
            integrationId, blank.Enabled, blank.DatasetId, !string.IsNullOrWhiteSpace(blank.AccessToken),
            blank.DatasetName, blank.LastVerifiedAt, blank.SendDealValue, blank.DefaultCallingCode,
            blank.EffectiveLeadEvents(), blank.EffectiveDealEvents(),
            Defaults(MetaConversionDefaults.LeadEvents, MetaConversionDefaults.LeadStatuses),
            Defaults(MetaConversionDefaults.DealEvents, MetaConversionDefaults.DealStages),
            blank.EnabledAt, blank.LastSentAt, blank.LastFailureAt, blank.LastError,
            new MetaConversionStatsDto(Count(MetaConversionStatus.Pending), Count(MetaConversionStatus.Sent),
                Count(MetaConversionStatus.Failed), Count(MetaConversionStatus.Skipped), sentWeek),
            metaLeads, MetaConversionPayload.LeadEventSource);
    }

    private static IReadOnlyDictionary<string, string> Defaults(IReadOnlyDictionary<string, string> map, string[] keys) =>
        keys.ToDictionary(k => k, k => map.TryGetValue(k, out var v) ? v : "");

    /// <summary>Keeps only keys the CRM actually has, so a stray key from a client never becomes stored config.</summary>
    public static Dictionary<string, string>? Known(Dictionary<string, string>? map, string[] allowed)
    {
        if (map is null) return null;
        return map.Where(kv => allowed.Contains(kv.Key.Trim().ToLowerInvariant()))
                  .ToDictionary(kv => kv.Key.Trim().ToLowerInvariant(), kv => kv.Value ?? "");
    }
}

internal sealed class GetMetaConversionsHandler(CrmDbContext db) : IQueryHandler<GetMetaConversionsQuery, MetaConversionsDto>
{
    public async Task<Result<MetaConversionsDto>> Handle(GetMetaConversionsQuery q, CancellationToken ct)
    {
        var integration = await MetaConversionSupport.MetaIntegrationAsync(db, q.IntegrationId, ct);
        if (!integration.IsSuccess) return Result.Failure<MetaConversionsDto>(integration.Error);

        var s = await db.MetaConversionSettings.AsNoTracking().FirstOrDefaultAsync(x => x.IntegrationId == q.IntegrationId, ct);
        return Result.Success(await MetaConversionSupport.ToDtoAsync(db, q.IntegrationId, s, ct));
    }
}

internal sealed class SaveMetaConversionsHandler(CrmDbContext db, ISecretProtector protector)
    : ICommandHandler<SaveMetaConversionsCommand, MetaConversionsDto>
{
    public async Task<Result<MetaConversionsDto>> Handle(SaveMetaConversionsCommand cmd, CancellationToken ct)
    {
        var integration = await MetaConversionSupport.MetaIntegrationAsync(db, cmd.IntegrationId, ct);
        if (!integration.IsSuccess) return Result.Failure<MetaConversionsDto>(integration.Error);

        var s = await db.MetaConversionSettings.FirstOrDefaultAsync(x => x.IntegrationId == cmd.IntegrationId, ct);
        var isNew = s is null;
        s ??= new MetaConversionSettings(cmd.IntegrationId);

        if (!string.IsNullOrWhiteSpace(cmd.AccessToken))
            s.SetAccessToken(protector.Protect(cmd.AccessToken.Trim()));

        // Switching on without a destination would queue events that can never be sent.
        if (cmd.Enabled && (string.IsNullOrWhiteSpace(cmd.DatasetId) || string.IsNullOrWhiteSpace(s.AccessToken)))
            return Result.Failure<MetaConversionsDto>(Error.Custom("Validation.Failed",
                "Enter the Dataset ID and the access token before switching this on."));

        s.Configure(cmd.Enabled, cmd.DatasetId, cmd.SendDealValue, cmd.DefaultCallingCode,
            MetaConversionSupport.Known(cmd.LeadEvents, MetaConversionDefaults.LeadStatuses),
            MetaConversionSupport.Known(cmd.DealEvents, MetaConversionDefaults.DealStages));

        if (isNew) db.MetaConversionSettings.Add(s);
        await db.SaveChangesAsync(ct);
        return Result.Success(await MetaConversionSupport.ToDtoAsync(db, cmd.IntegrationId, s, ct));
    }
}

internal sealed class VerifyMetaConversionsHandler(CrmDbContext db, ISecretProtector protector, MetaConversionsClient client)
    : ICommandHandler<VerifyMetaConversionsCommand, MetaVerifyResultDto>
{
    public async Task<Result<MetaVerifyResultDto>> Handle(VerifyMetaConversionsCommand cmd, CancellationToken ct)
    {
        var integration = await MetaConversionSupport.MetaIntegrationAsync(db, cmd.IntegrationId, ct);
        if (!integration.IsSuccess) return Result.Failure<MetaVerifyResultDto>(integration.Error);

        var s = await db.MetaConversionSettings.FirstOrDefaultAsync(x => x.IntegrationId == cmd.IntegrationId, ct);
        var token = protector.Unprotect(s?.AccessToken);
        if (s is null || string.IsNullOrWhiteSpace(s.DatasetId) || string.IsNullOrWhiteSpace(token))
            return Result.Success(new MetaVerifyResultDto(false, null, "Enter the Dataset ID and the access token first."));

        var check = await client.VerifyAsync(s.DatasetId, token, ct);
        if (check.Ok)
        {
            s.RecordVerified(check.Name);
            await db.SaveChangesAsync(ct);
            return Result.Success(new MetaVerifyResultDto(true, check.Name,
                check.Name is null ? "Connected to your Meta dataset." : $"Connected to “{check.Name}”."));
        }

        s.RecordFailure(check.Error ?? "Could not verify the dataset.");
        await db.SaveChangesAsync(ct);
        return Result.Success(new MetaVerifyResultDto(false, null, check.Error ?? "Could not verify the dataset."));
    }
}

internal sealed class SendMetaTestEventHandler(CrmDbContext db, ISecretProtector protector, MetaConversionsClient client)
    : ICommandHandler<SendMetaTestEventCommand, MetaTestResultDto>
{
    public async Task<Result<MetaTestResultDto>> Handle(SendMetaTestEventCommand cmd, CancellationToken ct)
    {
        var integration = await MetaConversionSupport.MetaIntegrationAsync(db, cmd.IntegrationId, ct);
        if (!integration.IsSuccess) return Result.Failure<MetaTestResultDto>(integration.Error);

        var s = await db.MetaConversionSettings.AsNoTracking().FirstOrDefaultAsync(x => x.IntegrationId == cmd.IntegrationId, ct);
        var token = protector.Unprotect(s?.AccessToken);
        if (s is null || string.IsNullOrWhiteSpace(s.DatasetId) || string.IsNullOrWhiteSpace(token))
            return Result.Success(new MetaTestResultDto(false, "Enter the Dataset ID and the access token first."));

        // One sample per distinct event name in the mapping, so the tenant sees every name they will actually
        // send appear in Events Manager — and can spot a typo before it is sent for real.
        var names = s.EffectiveLeadEvents().Values.Concat(s.EffectiveDealEvents().Values)
            .Where(n => !string.IsNullOrWhiteSpace(n)).Distinct().ToList();
        if (names.Count == 0)
            return Result.Success(new MetaTestResultDto(false, "No stages are set to send an event, so there is nothing to test."));

        var sampleUser = new JsonObject
        {
            ["em"] = new JsonArray(MetaHashing.Sha256("test@example.com")),
            ["lead_id"] = 1234567890123456,
        }.ToJsonString();

        var currency = TenantCurrency.Resolve();
        var dealNames = s.EffectiveDealEvents().Values.ToHashSet();
        var events = names.Select(n => MetaConversionPayload.ToEvent(new MetaConversionEvent(
                cmd.IntegrationId, Guid.Empty, null, n, DateTime.UtcNow, "1234567890123456", sampleUser,
                s.SendDealValue && dealNames.Contains(n) ? 1000m : null,
                s.SendDealValue && dealNames.Contains(n) ? currency : null)))
            .ToList();

        var result = await client.SendAsync(s.DatasetId, token, events, cmd.TestEventCode, ct);
        return Result.Success(result.Ok
            ? new MetaTestResultDto(true, $"Sent {result.EventsReceived} test event(s). They should appear in Events Manager → Test events within a minute.")
            : new MetaTestResultDto(false, result.Error ?? "Meta did not accept the test event."));
    }
}

internal sealed class RetryFailedMetaConversionsHandler(CrmDbContext db) : ICommandHandler<RetryFailedMetaConversionsCommand, int>
{
    public async Task<Result<int>> Handle(RetryFailedMetaConversionsCommand cmd, CancellationToken ct)
    {
        var integration = await MetaConversionSupport.MetaIntegrationAsync(db, cmd.IntegrationId, ct);
        if (!integration.IsSuccess) return Result.Failure<int>(integration.Error);

        var failed = await db.MetaConversionEvents
            .Where(e => e.IntegrationId == cmd.IntegrationId && e.Status == MetaConversionStatus.Failed)
            .ToListAsync(ct);
        foreach (var e in failed) e.Requeue();
        await db.SaveChangesAsync(ct);
        return Result.Success(failed.Count);
    }
}

internal sealed class GetMetaConversionEventsHandler(CrmDbContext db)
    : IQueryHandler<GetMetaConversionEventsQuery, IReadOnlyList<MetaConversionEventDto>>
{
    public async Task<Result<IReadOnlyList<MetaConversionEventDto>>> Handle(GetMetaConversionEventsQuery q, CancellationToken ct)
    {
        var integration = await MetaConversionSupport.MetaIntegrationAsync(db, q.IntegrationId, ct);
        if (!integration.IsSuccess) return Result.Failure<IReadOnlyList<MetaConversionEventDto>>(integration.Error);

        var query = db.MetaConversionEvents.AsNoTracking().Where(e => e.IntegrationId == q.IntegrationId);
        if (!string.IsNullOrWhiteSpace(q.Status)) query = query.Where(e => e.Status == q.Status);

        var rows = await query.OrderByDescending(e => e.CreatedAt).Take(Math.Clamp(q.Take, 1, 200)).ToListAsync(ct);

        var leadIds = rows.Select(r => r.LeadId).Distinct().ToList();
        var names = (await db.Leads.AsNoTracking().Where(l => leadIds.Contains(l.Id))
                .Select(l => new { l.Id, l.FirstName, l.LastName }).ToListAsync(ct))
            .ToDictionary(l => l.Id, l => $"{l.FirstName} {l.LastName}".Trim());

        IReadOnlyList<MetaConversionEventDto> dtos = rows.Select(r => new MetaConversionEventDto(
            r.Id, r.LeadId, names.GetValueOrDefault(r.LeadId) is { Length: > 0 } n ? n : "(unnamed lead)", r.DealId,
            r.EventName, r.EventTime, r.Value, r.Currency, r.Status, r.Attempts, r.NextAttemptAt, r.SentAt, r.LastError)).ToList();
        return Result.Success(dtos);
    }
}

/// <summary>
/// Reports the recent history of Meta leads that arrived before sending was switched on, so a tenant that is
/// already running ads does not have to wait for fresh leads to start teaching Meta.
///
/// <para>Strictly bounded to a week: Meta rejects old events, and an event it rejects teaches it nothing.
/// A lead that already has any event queued is left alone, which is what makes pressing this twice harmless
/// and stops it racing the live path.</para>
/// </summary>
internal sealed class CatchUpMetaConversionsHandler(CrmDbContext db) : ICommandHandler<CatchUpMetaConversionsCommand, MetaCatchUpResultDto>
{
    public async Task<Result<MetaCatchUpResultDto>> Handle(CatchUpMetaConversionsCommand cmd, CancellationToken ct)
    {
        var integration = await MetaConversionSupport.MetaIntegrationAsync(db, cmd.IntegrationId, ct);
        if (!integration.IsSuccess) return Result.Failure<MetaCatchUpResultDto>(integration.Error);

        var s = await db.MetaConversionSettings.AsNoTracking().FirstOrDefaultAsync(x => x.IntegrationId == cmd.IntegrationId, ct);
        if (s is null || !s.IsReady)
            return Result.Failure<MetaCatchUpResultDto>(Error.Custom("MetaConversions.Conflict",
                "Switch sending on and save before catching up."));

        var since = DateTime.UtcNow.AddDays(-Math.Clamp(cmd.Days, 1, 7));

        // Meta's own id per lead (the earliest enquiry). Only two columns — a source row also holds the raw payload.
        var sourceRows = await db.LeadSources.AsNoTracking()
            .Where(x => x.IntegrationId == cmd.IntegrationId && x.ProviderKey == "meta" && x.ExternalLeadId != null)
            .Select(x => new { x.LeadId, x.ExternalLeadId, x.ReceivedAt })
            .ToListAsync(ct);
        var refs = sourceRows.GroupBy(x => x.LeadId)
            .ToDictionary(g => g.Key, g => new MetaLeadRef(cmd.IntegrationId, g.OrderBy(x => x.ReceivedAt).First().ExternalLeadId!.Trim()));

        var tracked = (await db.MetaConversionEvents.AsNoTracking()
            .Where(e => e.IntegrationId == cmd.IntegrationId).Select(e => e.LeadId).Distinct().ToListAsync(ct)).ToHashSet();

        // Leads with anything happening in the window: new, edited, or whose opportunity moved.
        var dealHistory = await db.DealStageHistory.AsNoTracking().Where(h => h.CreatedAt >= since).ToListAsync(ct);
        var dealKeys = dealHistory.Select(h => h.DealId.ToString()).Distinct().ToList();

        var candidates = await db.Leads.AsNoTracking()
            .Where(l => !l.IsDeleted
                        && (l.CreatedAt >= since || (l.UpdatedAt != null && l.UpdatedAt >= since)
                            || (l.ConvertedDealId != null && dealKeys.Contains(l.ConvertedDealId))))
            .ToListAsync(ct);
        candidates = candidates.Where(l => refs.ContainsKey(l.Id)).ToList();

        var already = candidates.Count(l => tracked.Contains(l.Id));
        var todo = candidates.Where(l => !tracked.Contains(l.Id)).ToList();

        var todoIds = todo.Select(l => l.Id).ToList();
        var statusHistory = new List<LeadStatusHistory>();
        foreach (var chunk in todoIds.Chunk(500))
            statusHistory.AddRange(await db.LeadStatusHistory.AsNoTracking()
                .Where(h => chunk.Contains(h.LeadId) && h.CreatedAt >= since).ToListAsync(ct));
        var everHadHistory = new HashSet<Guid>();
        foreach (var chunk in todoIds.Chunk(500))
            foreach (var id in await db.LeadStatusHistory.AsNoTracking().Where(h => chunk.Contains(h.LeadId)).Select(h => h.LeadId).Distinct().ToListAsync(ct))
                everHadHistory.Add(id);

        var dealIds = todo.Select(l => Guid.TryParse(l.ConvertedDealId, out var d) ? d : (Guid?)null).Where(d => d is not null).Select(d => d!.Value).ToList();
        var deals = dealIds.Count == 0 ? new Dictionary<Guid, Deal>()
            : (await db.Deals.AsNoTracking().Where(d => dealIds.Contains(d.Id)).ToListAsync(ct)).ToDictionary(d => d.Id);

        var queued = new List<MetaConversionEvent>();
        var leadsQueued = 0;
        foreach (var lead in todo)
        {
            var src = refs[lead.Id];
            var before = queued.Count;
            void Add(MetaConversionEvent? e) { if (e is not null) queued.Add(e); }

            var history = statusHistory.Where(h => h.LeadId == lead.Id).OrderBy(h => h.CreatedAt).ToList();

            // A lead made in the CRM already has its opening status in the history (FromStatus null); one that
            // arrived through intake does not. Synthesise the opening event only when the history lacks it,
            // or the same "new lead" would be reported twice.
            if (lead.CreatedAt >= since && !history.Any(h => h.FromStatus is null))
                Add(MetaConversionBuilder.ForLead(s, lead, src, "new", lead.CreatedAt));
            foreach (var h in history)
                Add(MetaConversionBuilder.ForLead(s, lead, src, h.ToStatus, h.CreatedAt));
            // Leads from before status history existed have no rows: report where they are now.
            if (!everHadHistory.Contains(lead.Id) && lead.Status != "new" && (lead.UpdatedAt ?? lead.CreatedAt) >= since)
                Add(MetaConversionBuilder.ForLead(s, lead, src, lead.Status, lead.UpdatedAt ?? lead.CreatedAt));

            if (Guid.TryParse(lead.ConvertedDealId, out var dealId) && deals.TryGetValue(dealId, out var deal))
                foreach (var h in dealHistory.Where(h => h.DealId == dealId).OrderBy(h => h.CreatedAt))
                    Add(MetaConversionBuilder.ForDeal(s, lead, src, deal, h.ToStage, h.CreatedAt));

            if (queued.Count > before) leadsQueued++;
        }

        db.MetaConversionEvents.AddRange(queued);
        await db.SaveChangesAsync(ct);
        return Result.Success(new MetaCatchUpResultDto(leadsQueued, queued.Count, already, Math.Max(0, refs.Count - candidates.Count)));
    }
}
