using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Tables.Dtos;
using Softaxis.Restaurant.Application.Tables.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Tables;

internal sealed class GetTablesSummaryHandler(RestaurantDbContext db, IBranchAccessGuard branchAccess)
    : IQueryHandler<GetTablesSummaryQuery, TablesSummaryDto>
{
    public async Task<Result<TablesSummaryDto>> Handle(GetTablesSummaryQuery query, CancellationToken ct)
    {
        var accessible = await branchAccess.GetAccessibleBranchIdsAsync(ct);
        var all = await BranchScope.Apply(db.Tables.AsNoTracking().Where(x => !x.IsDeleted), accessible)
            .Select(x => new { x.Status, x.Section, x.Capacity }).ToListAsync(ct);

        var dto = new TablesSummaryDto(
            Total: all.Count,
            Available: all.Count(x => x.Status == "available"),
            Occupied: all.Count(x => x.Status == "occupied"),
            Reserved: all.Count(x => x.Status == "reserved"),
            Cleaning: all.Count(x => x.Status == "cleaning"),
            OccupancyRate: all.Count > 0
                ? Math.Round((double)all.Count(x => x.Status == "occupied") / all.Count * 100, 1) : 0,
            TotalCovers: all.Sum(x => x.Capacity));

        return Result.Success(dto);
    }
}
