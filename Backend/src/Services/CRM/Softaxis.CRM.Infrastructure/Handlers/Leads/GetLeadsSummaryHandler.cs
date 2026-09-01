using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Dtos;
using Softaxis.CRM.Application.Leads.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class GetLeadsSummaryHandler(CrmDbContext db, ILeadAccessGuard access) : IQueryHandler<GetLeadsSummaryQuery, LeadsSummaryDto>
{
    public async Task<Result<LeadsSummaryDto>> Handle(GetLeadsSummaryQuery query, CancellationToken ct)
    {
        // Captured before the expression so EF sends it as a parameter rather than failing to
        // translate DateTime.UtcNow.
        var weekAgo = DateTime.UtcNow.AddDays(-7);

        // Scoped like the list itself. Without this a team lead saw their own team in the grid
        // but tenant-wide totals in the stat cards above it — an aggregate leak of other teams' data.
        //
        // Aggregated in SQL. This used to pull every lead's Status, EstimatedValue and CreatedAt
        // into memory and count them with LINQ-to-Objects — a full scan reading 1,914 pages to
        // produce six numbers, which the app's own logger was flagging as SLOW at ~550 ms. Grouping
        // on a constant is the standard way to ask EF for whole-set aggregates: it becomes one
        // SELECT of conditional COUNT/SUM and returns a single row.
        var agg = await access.ScopeReadable(db.Leads.AsNoTracking()).Where(x => !x.IsDeleted)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Total     = g.Count(),
                ThisWeek  = g.Count(x => x.CreatedAt >= weekAgo),
                Qualified = g.Count(x => x.Status == "qualified"),
                Contacted = g.Count(x => x.Status == "contacted"),
                Converted = g.Count(x => x.Status == "converted"),
                Value     = g.Sum(x => x.EstimatedValue),
            })
            .FirstOrDefaultAsync(ct);

        // No rows at all: GroupBy yields no groups, so there is nothing to project. A tenant with
        // no leads gets zeroes rather than a null-reference.
        if (agg is null)
            return Result.Success(new LeadsSummaryDto(0, 0, 0, 0, 0, 0, 0m));

        return Result.Success(new LeadsSummaryDto(
            agg.Total,
            agg.ThisWeek,
            agg.Qualified,
            agg.Contacted,
            agg.Converted,
            agg.Total > 0 ? Math.Round((double)agg.Converted / agg.Total * 100, 1) : 0,
            agg.Value));
    }
}
