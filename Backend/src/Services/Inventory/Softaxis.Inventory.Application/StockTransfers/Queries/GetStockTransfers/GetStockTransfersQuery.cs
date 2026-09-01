using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Inventory.Application.StockTransfers.Dtos;

namespace Softaxis.Inventory.Application.StockTransfers.Queries.GetStockTransfers;

/// <summary>
/// Transfers are kept forever and each one drags its line items along, so this pages in SQL rather
/// than loading the warehouse's whole movement history to show one screen of it.
/// </summary>
public sealed record GetStockTransfersQuery(
    string? Status   = null,
    string? Search   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<StockTransferDto>>;
