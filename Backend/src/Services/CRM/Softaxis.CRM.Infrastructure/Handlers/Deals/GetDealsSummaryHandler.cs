using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Deals.Dtos;
using Softaxis.CRM.Application.Deals.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Deals;

internal sealed class GetDealsSummaryHandler(CrmDbContext db, ILeadAccessGuard access) : IQueryHandler<GetDealsSummaryQuery, DealsSummaryDto>
{
    public async Task<Result<DealsSummaryDto>> Handle(GetDealsSummaryQuery query, CancellationToken ct)
    {
        // Totals follow the caller's pipeline tier, so the stat cards agree with the board below them.
        var all = await access.ScopeDeals(db.Deals.AsNoTracking()).Where(x => !x.IsDeleted)
            .Select(x => new { x.Stage, x.Value, x.Probability, x.ForecastCategory }).ToListAsync(ct);

        var won = all.Where(x => x.Stage == "won").ToList();
        var open = all.Where(x => x.Stage != "won" && x.Stage != "lost").ToList();
        var total = all.Count;

        return Result.Success(new DealsSummaryDto(
            total,
            all.Sum(x => x.Value),
            won.Sum(x => x.Value),
            all.Count(x => x.Stage == "lost"),
            total > 0 ? all.Average(x => x.Value) : 0,
            total > 0 ? Math.Round((double)won.Count / total * 100, 1) : 0,
            open.Sum(x => x.Value),
            open.Sum(x => Math.Round(x.Value * x.Probability / 100m, 2)),
            open.Where(x => x.ForecastCategory == "commit").Sum(x => x.Value),
            open.Where(x => x.ForecastCategory == "commit" || x.ForecastCategory == "best_case").Sum(x => x.Value)));
    }
}
