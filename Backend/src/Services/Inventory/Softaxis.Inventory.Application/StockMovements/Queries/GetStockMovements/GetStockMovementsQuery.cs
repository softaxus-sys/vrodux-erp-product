using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.StockMovements.Queries.GetStockMovements;

public sealed record GetStockMovementsQuery(
    int       Page         = 1,
    int       PageSize     = 20,
    Guid?     ProductId    = null,
    string?   MovementType = null,
    DateTime? From         = null,
    DateTime? To           = null,
    Guid?     WarehouseId  = null
) : IQuery<PagedResult<StockMovementDto>>;
