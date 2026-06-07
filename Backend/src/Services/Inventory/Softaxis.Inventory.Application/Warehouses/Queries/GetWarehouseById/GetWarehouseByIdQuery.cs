using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.Warehouses.Queries.GetWarehouseById;

public sealed record GetWarehouseByIdQuery(Guid Id) : IQuery<WarehouseDto>;
