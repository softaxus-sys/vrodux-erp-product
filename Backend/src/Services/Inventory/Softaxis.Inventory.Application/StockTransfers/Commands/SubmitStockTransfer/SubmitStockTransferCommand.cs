using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.StockTransfers.Commands.SubmitStockTransfer;

public sealed record SubmitStockTransferCommand(Guid Id) : ICommand;
