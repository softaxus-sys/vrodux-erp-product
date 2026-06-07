using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.PurchaseOrders.Commands.CreatePurchaseOrder;

public sealed record PurchaseOrderItemRequest(
    Guid?   ProductId,
    string  Description,
    decimal Quantity,
    decimal UnitCost,
    decimal TaxRate);

public sealed record CreatePurchaseOrderCommand(
    Guid    VendorId,
    string? Notes,
    string? ExpectedDate,
    List<PurchaseOrderItemRequest> Items)
    : ICommand<PurchaseOrderDto>;
