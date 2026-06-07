using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.Warehouses.Queries.GetWarehouses;

public sealed record GetWarehousesQuery : IQuery<IReadOnlyList<WarehouseDto>>;
