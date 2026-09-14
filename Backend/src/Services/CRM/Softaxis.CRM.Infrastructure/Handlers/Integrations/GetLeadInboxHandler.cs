using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Dtos;
using Softaxis.CRM.Application.Integrations.Queries;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

/// <summary>
/// The Lead Inbox list: every inbound delivery across every integration this tenant has, newest
/// first. Tenant scoping is the DbContext's global filter — inbox rows are stamped with the tenant
/// resolved from the inbound key, so an anonymous webhook's row still lands in the right workspace.
/// </summary>
internal sealed class GetLeadInboxHandler(CrmDbContext db)
    : IQueryHandler<GetLeadInboxQuery, PagedResult<LeadInboxRowDto>>
{
    public async Task<Result<PagedResult<LeadInboxRowDto>>> Handle(GetLeadInboxQuery query, CancellationToken ct)
    {
        var page     = query.Page     < 1 ? 1  : query.Page;
        var pageSize = query.PageSize is < 1 or > 200 ? 25 : query.PageSize;

        var q = db.RawLeadInbox.AsNoTracking().AsQueryable();

        if (query.IntegrationId is { } integrationId)
            q = q.Where(x => x.IntegrationId == integrationId);
        if (!string.IsNullOrWhiteSpace(query.ProviderKey))
        {
            var key = query.ProviderKey.Trim().ToLowerInvariant();
            q = q.Where(x => x.ProviderKey == key);
        }
        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            var status = query.Status.Trim().ToLowerInvariant();
            q = q.Where(x => x.Status == status);
        }
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            // The payload is the only place a phone number or an agent's name appears before the
            // lead exists, so a failed delivery is findable by what was actually in it.
            var s = query.Search.Trim();
            q = q.Where(x => (x.ExternalId != null && x.ExternalId.Contains(s)) || x.Payload.Contains(s));
        }

        var total = await q.CountAsync(ct);
        var rows  = await q.OrderByDescending(x => x.ReceivedAt)
                           .Skip((page - 1) * pageSize).Take(pageSize)
                           .ToListAsync(ct);

        var items = await LeadInboxEnrichment.ToRowsAsync(db, rows, ct);
        return Result.Success(PagedResult<LeadInboxRowDto>.Create(items, total, page, pageSize));
    }
}

/// <summary>
/// Resolves the integration name and the created lead's name for a page of inbox rows.
/// Two set queries rather than a per-row lookup: neither is a navigation on <see cref="RawLeadInbox"/>
/// (the codebase links across aggregates by scalar id), so a naive projection would be N+1.
/// </summary>
internal static class LeadInboxEnrichment
{
    public static async Task<(Dictionary<Guid, string> Integrations, Dictionary<Guid, string> Leads)>
        LookupAsync(CrmDbContext db, IReadOnlyList<RawLeadInbox> rows, CancellationToken ct)
    {
        var integrationIds = rows.Select(r => r.IntegrationId).Distinct().ToList();
        var integrations = await db.Integrations.AsNoTracking()
            .Where(i => integrationIds.Contains(i.Id))
            .Select(i => new { i.Id, i.Name })
            .ToDictionaryAsync(x => x.Id, x => x.Name, ct);

        var leadIds = rows.Where(r => r.CreatedLeadId.HasValue).Select(r => r.CreatedLeadId!.Value).Distinct().ToList();
        var leads = leadIds.Count == 0
            ? []
            // FullName is computed, so the projection has to select the parts and join them here.
            : (await db.Leads.AsNoTracking().Where(l => leadIds.Contains(l.Id))
                .Select(l => new { l.Id, l.FirstName, l.LastName })
                .ToListAsync(ct))
                .ToDictionary(x => x.Id, x => $"{x.FirstName} {x.LastName}".Trim());

        return (integrations, leads);
    }

    public static async Task<List<LeadInboxRowDto>> ToRowsAsync(
        CrmDbContext db, IReadOnlyList<RawLeadInbox> rows, CancellationToken ct)
    {
        var (integrations, leads) = await LookupAsync(db, rows, ct);
        return rows.Select(r => new LeadInboxRowDto(
            r.Id, r.IntegrationId, r.ProviderKey,
            integrations.TryGetValue(r.IntegrationId, out var n) ? n : r.ProviderKey,
            r.ExternalId, r.Status, r.Attempts, r.LastError,
            r.CreatedLeadId,
            r.CreatedLeadId is { } lid && leads.TryGetValue(lid, out var ln) && ln.Length > 0 ? ln : null,
            r.ReceivedAt, r.ProcessedAt, r.NextAttemptAt)).ToList();
    }
}
