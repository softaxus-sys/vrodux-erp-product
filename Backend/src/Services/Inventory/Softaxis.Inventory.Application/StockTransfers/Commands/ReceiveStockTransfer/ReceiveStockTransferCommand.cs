using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.StockTransfers.Commands.ReceiveStockTransfer;

public sealed record ReceiveStockTransferCommand(Guid Id) : ICommand;
