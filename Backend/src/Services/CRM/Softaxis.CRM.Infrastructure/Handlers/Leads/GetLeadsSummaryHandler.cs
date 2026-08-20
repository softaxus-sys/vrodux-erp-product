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
        // Scoped like the list itself. Without this a team lead saw their own team in the grid
        // but tenant-wide totals in the stat cards above it — an aggregate leak of other teams' data.
        var all = await access.ScopeReadable(db.Leads.AsNoTracking()).Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.EstimatedValue, x.CreatedAt }).ToListAsync(ct);

        var weekAgo = DateTime.UtcNow.AddDays(-7);
        var converted = all.Count(x => x.Status == "converted");
        var total = all.Count;

        return Result.Success(new LeadsSummaryDto(
            total,
            all.Count(x => x.CreatedAt >= weekAgo),
            all.Count(x => x.Status == "qualified"),
            all.Count(x => x.Status == "contacted"),
            converted,
            total > 0 ? Math.Round((double)converted / total * 100, 1) : 0,
            all.Sum(x => x.EstimatedValue)));
    }
}
