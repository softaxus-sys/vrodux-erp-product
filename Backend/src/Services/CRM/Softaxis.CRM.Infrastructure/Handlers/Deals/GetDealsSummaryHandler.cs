using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Deals.Dtos;
using Softaxis.CRM.Application.Deals.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Deals;

internal sealed class GetDealsSummaryHandler(CrmDbContext db) : IQueryHandler<GetDealsSummaryQuery, DealsSummaryDto>
{
    public async Task<Result<DealsSummaryDto>> Handle(GetDealsSummaryQuery query, CancellationToken ct)
    {
        var all = await db.Deals.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Stage, x.Value }).ToListAsync(ct);

        var won = all.Where(x => x.Stage == "won").ToList();
        var total = all.Count;

        return Result.Success(new DealsSummaryDto(
            total,
            all.Sum(x => x.Value),
            won.Sum(x => x.Value),
            all.Count(x => x.Stage == "lost"),
            total > 0 ? all.Average(x => x.Value) : 0,
            total > 0 ? Math.Round((double)won.Count / total * 100, 1) : 0));
    }
}
