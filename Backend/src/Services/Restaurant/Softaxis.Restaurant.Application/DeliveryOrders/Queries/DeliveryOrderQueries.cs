using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.DeliveryOrders.Dtos;

namespace Softaxis.Restaurant.Application.DeliveryOrders.Queries;

public sealed record GetDeliveryOrdersQuery(string? Status) : IQuery<IReadOnlyList<DeliveryOrderDto>>;

public sealed record GetDeliveryOrderByIdQuery(Guid Id) : IQuery<DeliveryOrderDto>;

public sealed record GetDeliverySummaryQuery : IQuery<DeliverySummaryDto>;

public sealed record GetDeliveryProvidersQuery : IQuery<IReadOnlyList<DeliveryProviderDto>>;

/// <summary>Anonymous — the token itself is the authorization (unguessable Guid, no tenant/session needed).</summary>
public sealed record GetDeliveryTrackingQuery(string Token) : IQuery<DeliveryTrackingDto>;
