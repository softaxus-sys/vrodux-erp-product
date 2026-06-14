using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Bidding.Dtos;
using Softaxis.Construction.Application.Bidding.Queries;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Bidding;

internal sealed class GetBiddingSummaryHandler(ConstructionDbContext db)
    : IQueryHandler<GetBiddingSummaryQuery, BiddingSummaryDto>
{
    public async Task<Result<BiddingSummaryDto>> Handle(GetBiddingSummaryQuery query, CancellationToken ct)
    {
        var rfqs = await db.Rfqs.AsNoTracking().Select(x => x.Status).ToListAsync(ct);
        var est  = await db.Estimates.AsNoTracking().Select(x => new { x.Status, x.Amount }).ToListAsync(ct);
        var con  = await db.Contracts.AsNoTracking().Select(x => new { x.Status, x.ContractValue }).ToListAsync(ct);

        var dto = new BiddingSummaryDto(
            rfqs.Count(s => s == "open"),
            rfqs.Count,
            est.Count(x => x.Status is "draft" or "sent"),
            est.Sum(x => x.Amount),
            con.Count(x => x.Status == "active"),
            con.Where(x => x.Status is "active" or "completed").Sum(x => x.ContractValue));

        return Result.Success(dto);
    }
}
