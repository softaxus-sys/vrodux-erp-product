using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.PurchaseOrders.Queries.GetPurchaseOrderById;

public sealed record GetPurchaseOrderByIdQuery(Guid Id) : IQuery<PurchaseOrderDto>;
