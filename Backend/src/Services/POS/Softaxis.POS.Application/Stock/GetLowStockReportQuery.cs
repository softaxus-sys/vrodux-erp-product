using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;

namespace Softaxis.POS.Application.Stock;

/// <summary>
/// Everything that needs buying, in one list: every active, stock-tracked product that is out of
/// stock or at/below its reorder level — from both pos.products and inventory.products, since the
/// till sells from both.
/// </summary>
/// <param name="SalesDays">How many days of sales to show beside each item, and to size the suggested order by.</param>
public sealed record GetLowStockReportQuery(int SalesDays = 30) : IQuery<LowStockReportDto>;

public sealed class GetLowStockReportQueryValidator : AbstractValidator<GetLowStockReportQuery>
{
    public GetLowStockReportQueryValidator()
    {
        RuleFor(x => x.SalesDays).InclusiveBetween(1, 365);
    }
}

/// <param name="Status">"out" (nothing left) or "low" (at or below the reorder level).</param>
/// <param name="Shortage">How far below the reorder level the stock is; 0 when no level is set.</param>
/// <param name="SoldInPeriod">Units sold at the till in the last <c>SalesDays</c> days (completed sales only).</param>
/// <param name="SuggestedOrderQty">
/// Enough to reach the larger of twice the reorder level and what sold in the period. A starting
/// point for the buyer, not a forecast — 0 when the product has neither a reorder level nor sales.
/// </param>
public sealed record LowStockItemDto(
    Guid    Id,
    string  Name,
    string? Sku,
    string? Barcode,
    string  Category,
    string  Unit,
    decimal StockQuantity,
    decimal ReorderLevel,
    decimal Shortage,
    decimal SoldInPeriod,
    decimal SuggestedOrderQty,
    decimal CostPrice,
    decimal EstimatedCost,
    string  Status);

public sealed record LowStockReportDto(
    int     SalesDays,
    int     OutOfStockCount,
    int     LowStockCount,
    decimal EstimatedCost,
    IReadOnlyList<LowStockItemDto> Items);

public sealed class GetLowStockReportQueryHandler(ILowStockReadService reads, ICurrentUser currentUser)
    : IQueryHandler<GetLowStockReportQuery, LowStockReportDto>
{
    public async Task<Result<LowStockReportDto>> Handle(GetLowStockReportQuery query, CancellationToken ct)
    {
        // Cost prices are on this report, so it is not a cashier's view.
        if (!currentUser.HasPermission("pos.reports.view") && !currentUser.HasPermission("pos.products.view"))
            return Result.Failure<LowStockReportDto>(Error.Custom("LowStock.Forbidden",
                "You need the POS reports or products permission to view the low stock report."));

        var rows = await reads.GetLowStockAsync(query.SalesDays, ct);

        var items = rows.Select(r =>
        {
            var target    = Math.Max(r.ReorderLevel * 2, r.SoldInPeriod);
            var suggested = Math.Round(Math.Max(0m, target - r.StockQuantity), 2);
            return new LowStockItemDto(
                r.Id, r.Name, r.Sku, r.Barcode, r.Category, r.Unit,
                r.StockQuantity, r.ReorderLevel,
                Math.Max(0m, r.ReorderLevel - r.StockQuantity),
                r.SoldInPeriod, suggested, r.CostPrice,
                Math.Round(suggested * r.CostPrice, 2),
                r.StockQuantity <= 0 ? "out" : "low");
        })
        // Out of stock first, then the deepest shortage — the order a buyer works down the list.
        .OrderBy(i => i.Status == "out" ? 0 : 1)
        .ThenByDescending(i => i.Shortage)
        .ThenBy(i => i.Name)
        .ToList();

        return Result.Success(new LowStockReportDto(
            query.SalesDays,
            items.Count(i => i.Status == "out"),
            items.Count(i => i.Status == "low"),
            items.Sum(i => i.EstimatedCost),
            items));
    }
}
