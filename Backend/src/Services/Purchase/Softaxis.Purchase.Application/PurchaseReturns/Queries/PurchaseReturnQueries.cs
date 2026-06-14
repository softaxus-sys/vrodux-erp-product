using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Purchase.Application.PurchaseReturns.Dtos;

namespace Softaxis.Purchase.Application.PurchaseReturns.Queries;

public sealed record GetPurchaseReturnsQuery(Guid? PurchaseOrderId = null, Guid? VendorId = null)
    : IQuery<IReadOnlyList<PurchaseReturnSummaryDto>>;

public sealed record GetPurchaseReturnByIdQuery(Guid Id) : IQuery<PurchaseReturnDto>;
