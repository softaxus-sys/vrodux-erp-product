using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Tables.Dtos;
using Softaxis.Restaurant.Application.Tables.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Tables;

internal sealed class GetTablesHandler(RestaurantDbContext db, IBranchAccessGuard branchAccess)
    : IQueryHandler<GetTablesQuery, IReadOnlyList<TableDto>>
{
    public async Task<Result<IReadOnlyList<TableDto>>> Handle(GetTablesQuery query, CancellationToken ct)
    {
        var accessible = await branchAccess.GetAccessibleBranchIdsAsync(ct);
        var items = await BranchScope.Apply(db.Tables.AsNoTracking()
            .Where(x => !x.IsDeleted), accessible) // TenantIsolation.ApplyTenantId overwrites the entity's own HasQueryFilter — re-apply explicitly
            .OrderBy(x => x.Section).ThenBy(x => x.TableNumber)
            .Select(t => new TableDto(
                t.Id, t.TableNumber, t.Section, t.Capacity, t.Status,
                t.CurrentOrderId, t.CurrentWaiter, t.OccupiedSince,
                t.BranchId, t.DiningAreaId, t.PosX, t.PosY, t.Shape, t.Rotation, t.MergedIntoTableId))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<TableDto>>(items);
    }
}
