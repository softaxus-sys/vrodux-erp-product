using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.StockTransfers.Dtos;

namespace Softaxis.Inventory.Application.StockTransfers.Queries.GetStockTransferById;

public sealed record GetStockTransferByIdQuery(Guid Id) : IQuery<StockTransferDto>;
