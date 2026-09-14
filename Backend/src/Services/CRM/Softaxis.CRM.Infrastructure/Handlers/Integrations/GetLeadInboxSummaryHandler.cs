using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Dtos;
using Softaxis.CRM.Application.Integrations.Queries;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

/// <summary>
/// Counts for the Lead Inbox header. Computed in SQL over the whole set rather than from the
/// loaded page — a "3 failed" badge derived from 25 visible rows is worse than no badge.
/// </summary>
internal sealed class GetLeadInboxSummaryHandler(CrmDbContext db)
    : IQueryHandler<GetLeadInboxSummaryQuery, LeadInboxSummaryDto>
{
    public async Task<Result<LeadInboxSummaryDto>> Handle(GetLeadInboxSummaryQuery query, CancellationToken ct)
    {
        var byStatus = await db.RawLeadInbox.AsNoTracking()
            .GroupBy(x => x.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        int Count(params string[] statuses) => byStatus.Where(x => statuses.Contains(x.Status)).Sum(x => x.Count);

        var byProvider = await db.RawLeadInbox.AsNoTracking()
            .GroupBy(x => x.ProviderKey)
            .Select(g => new
            {
                ProviderKey = g.Key,
                Total  = g.Count(),
                Failed = g.Count(x => x.Status == RawLeadStatus.Failed),
            })
            .ToListAsync(ct);

        // Provider keys are stable; the tenant's own integration name is what they recognise.
        var names = await db.Integrations.AsNoTracking()
            .Select(i => new { i.ProviderKey, i.Name })
            .ToListAsync(ct);

        var providers = byProvider
            .Select(p => new LeadInboxProviderCountDto(
                p.ProviderKey,
                names.FirstOrDefault(n => n.ProviderKey == p.ProviderKey)?.Name ?? p.ProviderKey,
                p.Total, p.Failed))
            .OrderByDescending(p => p.Total)
            .ToList();

        return Result.Success(new LeadInboxSummaryDto(
            Total:      byStatus.Sum(x => x.Count),
            Pending:    Count(RawLeadStatus.Pending, RawLeadStatus.Processing),
            Processed:  Count(RawLeadStatus.Processed),
            Duplicates: Count(RawLeadStatus.Duplicate),
            Failed:     Count(RawLeadStatus.Failed),
            ByProvider: providers));
    }
}
