using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Sales.Application.DeliveryChallans.Dtos;

namespace Softaxis.Sales.Application.DeliveryChallans.Queries;

public sealed record GetDeliveryChallansQuery(
    Guid?  SalesOrderId = null,
    Guid?  CustomerId   = null
) : IQuery<IReadOnlyList<DeliveryChallanSummaryDto>>;

public sealed record GetDeliveryChallanByIdQuery(Guid Id) : IQuery<DeliveryChallanDto>;
