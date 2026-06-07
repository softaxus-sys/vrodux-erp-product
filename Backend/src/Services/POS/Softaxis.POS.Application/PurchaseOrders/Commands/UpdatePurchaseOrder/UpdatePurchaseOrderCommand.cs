using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.PurchaseOrders.Commands.CreatePurchaseOrder;

namespace Softaxis.POS.Application.PurchaseOrders.Commands.UpdatePurchaseOrder;

public sealed record UpdatePurchaseOrderCommand(
    Guid    Id,
    Guid    VendorId,
    string  Status,
    string? Notes,
    string? ExpectedDate,
    List<PurchaseOrderItemRequest> Items)
    : ICommand;
