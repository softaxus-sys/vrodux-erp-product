using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.Products.Queries.GetInventoryDashboard;

/// <summary>
/// Aggregates for the dashboard's inventory charts.
///
/// <para>The charts used to be computed in the browser over a single 1,000-row page of products —
/// which is both a large read and quietly wrong: a tenant with more than a thousand products got
/// figures for an arbitrary subset of them, with nothing on screen saying so. A chart cannot be
/// paged, so the aggregation belongs in SQL.</para>
/// </summary>
public sealed record GetInventoryDashboardQuery : IQuery<InventoryDashboardDto>;

/// <param name="Category">Category name, or "Uncategorised" when the product has none.</param>
public sealed record StockByCategoryDto(
    string Category,
    int    InStock,
    int    LowStock,
    int    OutOfStock);

/// <param name="Value">Stock at cost: quantity × cost price.</param>
public sealed record CategoryValuationDto(string Name, decimal Value);

public sealed record InventoryDashboardDto(
    IReadOnlyList<StockByCategoryDto>   StockByCategory,
    IReadOnlyList<CategoryValuationDto> Valuation);
