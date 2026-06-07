using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.POS.Application.PurchaseOrders.Commands.UpdatePurchaseOrderStatus;

public sealed record UpdatePurchaseOrderStatusCommand(Guid Id, string Status) : ICommand;
