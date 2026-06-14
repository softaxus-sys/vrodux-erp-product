using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Inventory.Application.StockTransfers.Commands.ApproveStockTransfer;

public sealed record ApproveStockTransferCommand(Guid Id, string By) : ICommand;
