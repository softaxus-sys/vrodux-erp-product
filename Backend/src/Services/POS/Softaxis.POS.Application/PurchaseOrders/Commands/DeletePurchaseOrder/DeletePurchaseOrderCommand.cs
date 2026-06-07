using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.POS.Application.PurchaseOrders.Commands.DeletePurchaseOrder;

public sealed record DeletePurchaseOrderCommand(Guid Id) : ICommand;
