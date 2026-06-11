using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.StockTransfers.Dtos;

namespace Softaxis.Inventory.Application.StockTransfers.Queries.GetStockTransfersSummary;

public sealed record GetStockTransfersSummaryQuery : IQuery<StockTransferSummaryDto>;
