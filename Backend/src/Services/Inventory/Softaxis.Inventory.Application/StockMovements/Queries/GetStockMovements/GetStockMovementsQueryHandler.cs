using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.StockMovements.Queries.GetStockMovements;

public sealed class GetStockMovementsQueryHandler(IStockMovementRepository movementRepo)
    : IQueryHandler<GetStockMovementsQuery, PagedResult<StockMovementDto>>
{
    public async Task<Result<PagedResult<StockMovementDto>>> Handle(GetStockMovementsQuery query, CancellationToken ct)
    {
        var paged = await movementRepo.GetPagedAsync(
            query.Page, query.PageSize,
            query.ProductId, query.MovementType,
            query.From, query.To, query.WarehouseId, ct);

        var dtos = paged.Items.Select(m => new StockMovementDto(
            m.Id, m.ProductId,
            m.Product?.Name  ?? "Unknown",
            m.Product?.SKU,
            m.MovementType,
            m.Quantity, m.UnitCost, m.Quantity * m.UnitCost,
            m.Reference, m.Notes,
            m.WarehouseId,
            m.Warehouse?.Name,
            m.MovedAt, m.CreatedAt)).ToList();

        return Result.Success(PagedResult<StockMovementDto>.Create(dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}
