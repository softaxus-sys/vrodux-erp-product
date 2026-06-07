using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.StockMovements.Queries.GetStockMovements;

public sealed record GetStockMovementsQuery(
    Guid?     ProductId,
    string?   Type,
    string?   From,
    string?   To,
    int       Page,
    int       PageSize)
    : IQuery<PagedResult<POSStockMovementDto>>;
