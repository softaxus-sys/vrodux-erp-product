using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Boqs.Dtos;
using Softaxis.Construction.Application.Boqs.Queries;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Boqs;

internal sealed class GetBoqsSummaryHandler(ConstructionDbContext db)
    : IQueryHandler<GetBoqsSummaryQuery, BoqsSummaryDto>
{
    public async Task<Result<BoqsSummaryDto>> Handle(GetBoqsSummaryQuery query, CancellationToken ct)
    {
        var boqs = await db.BOQs.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status }).ToListAsync(ct);

        var items = await db.BoqItems.AsNoTracking()
            .Select(x => new { x.Quantity, x.UnitRate, x.CompletedQty }).ToListAsync(ct);

        var totalValue     = items.Sum(i => i.Quantity * i.UnitRate);
        var completedValue = items.Sum(i => i.CompletedQty * i.UnitRate);

        var dto = new BoqsSummaryDto(
            boqs.Count,
            boqs.Count(x => x.Status == "draft"),
            boqs.Count(x => x.Status == "approved"),
            totalValue,
            completedValue,
            totalValue > 0 ? (double)Math.Round(completedValue / totalValue * 100, 1) : 0);

        return Result.Success(dto);
    }
}
