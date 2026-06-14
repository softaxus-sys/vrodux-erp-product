using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.StockTransfers.Dtos;

namespace Softaxis.Inventory.Application.StockTransfers.Queries.GetStockTransfers;

public sealed record GetStockTransfersQuery : IQuery<IReadOnlyList<StockTransferDto>>;
