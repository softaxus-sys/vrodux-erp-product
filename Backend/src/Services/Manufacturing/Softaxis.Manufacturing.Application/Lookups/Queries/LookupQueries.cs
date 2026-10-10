using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Manufacturing.Application.Abstractions;

namespace Softaxis.Manufacturing.Application.Lookups.Queries;

/// <summary>
/// Product and warehouse pickers for the Manufacturing forms. Served here rather than from
/// the Inventory API so a Manufacturing user needs no Inventory permission to build a BOM.
/// </summary>
public sealed record GetStockItemsQuery(string? Search) : IQuery<IReadOnlyList<StockItem>>;

public sealed record GetStockWarehousesQuery : IQuery<IReadOnlyList<StockWarehouse>>;
