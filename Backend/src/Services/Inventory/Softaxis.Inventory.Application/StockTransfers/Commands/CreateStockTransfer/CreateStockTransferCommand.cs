using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.StockTransfers.Dtos;

namespace Softaxis.Inventory.Application.StockTransfers.Commands.CreateStockTransfer;

public sealed record CreateStockTransferCommand(
    string  FromWarehouseId,
    string  FromWarehouseName,
    string  ToWarehouseId,
    string  ToWarehouseName,
    string  RequestedBy,
    string  ExpectedDate,
    string? Notes,
    IReadOnlyList<StockTransferItemRequestDto> Items) : ICommand<StockTransferDto>;
