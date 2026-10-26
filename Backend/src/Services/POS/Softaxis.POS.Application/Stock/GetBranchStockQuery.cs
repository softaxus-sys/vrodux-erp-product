using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;

namespace Softaxis.POS.Application.Stock;

/// <summary>
/// What each branch holds of each product, as last reported by the branch server. Head office reads it;
/// the branch writes it (see BranchStock). One row per branch per product.
/// </summary>
public sealed record GetBranchStockQuery(Guid? ProductId = null, Guid? BranchId = null, string? Search = null)
    : IQuery<IReadOnlyList<BranchStockRowDto>>;

public sealed record BranchStockRowDto(
    Guid     ProductId,
    string   ProductName,
    string?  Sku,
    string   Unit,
    decimal  ReorderLevel,
    Guid     BranchId,
    string   BranchName,
    decimal  StockQuantity,
    DateTime? AsOf);

public interface IBranchStockReadService
{
    Task<IReadOnlyList<BranchStockRowDto>> GetAsync(Guid? productId, Guid? branchId, string? search, CancellationToken ct = default);
}

public sealed class GetBranchStockQueryHandler(IBranchStockReadService reads, ICurrentUser currentUser)
    : IQueryHandler<GetBranchStockQuery, IReadOnlyList<BranchStockRowDto>>
{
    public async Task<Result<IReadOnlyList<BranchStockRowDto>>> Handle(GetBranchStockQuery query, CancellationToken ct)
    {
        if (!currentUser.HasPermission("pos.products.view") && !currentUser.HasPermission("pos.reports.view"))
            return Result.Failure<IReadOnlyList<BranchStockRowDto>>(Error.Custom("BranchStock.Forbidden",
                "You need the POS products or reports permission to see stock by branch."));

        return Result.Success(await reads.GetAsync(query.ProductId, query.BranchId, query.Search, ct));
    }
}
