using Softaxis.Restaurant.Application.Tables.Dtos;
using Softaxis.Restaurant.Domain.Entities;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Tables;

internal static class TableMappings
{
    public static TableDto ToDto(Table t) => new(
        t.Id, t.TableNumber, t.Section, t.Capacity, t.Status,
        t.CurrentOrderId, t.CurrentWaiter, t.OccupiedSince,
        t.BranchId, t.DiningAreaId, t.PosX, t.PosY, t.Shape, t.Rotation, t.MergedIntoTableId);
}
