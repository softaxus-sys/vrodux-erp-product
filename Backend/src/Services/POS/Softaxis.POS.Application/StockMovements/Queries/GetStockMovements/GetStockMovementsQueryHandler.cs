using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.StockMovements.Queries.GetStockMovements;

public sealed class GetStockMovementsQueryHandler(IStockMovementRepository movementRepo)
    : IQueryHandler<GetStockMovementsQuery, PagedResult<POSStockMovementDto>>
{
    public async Task<Result<PagedResult<POSStockMovementDto>>> Handle(
        GetStockMovementsQuery query, CancellationToken ct)
    {
        StockAdjustmentType? typeFilter = null;
        if (!string.IsNullOrWhiteSpace(query.Type) &&
            Enum.TryParse<StockAdjustmentType>(query.Type, ignoreCase: true, out var parsed))
            typeFilter = parsed;

        DateTime? from = DateTime.TryParse(query.From, out var f) ? f           : null;
        DateTime? to   = DateTime.TryParse(query.To,   out var t) ? t.AddDays(1) : null;

        var paged = await movementRepo.GetPagedAsync(
            query.Page, query.PageSize,
            query.ProductId, typeFilter,
            from, to, ct);

        var dtos = paged.Items.Select(m => new POSStockMovementDto(
            m.Id, m.ProductId,
            m.Product?.Name  ?? "Unknown",
            m.Product?.SKU,
            m.AdjustmentType.ToString(),
            m.Quantity, m.BalanceAfter,
            m.Reference, m.Notes,
            m.CreatedAt)).ToList();

        return Result.Success(
            PagedResult<POSStockMovementDto>.Create(dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}
