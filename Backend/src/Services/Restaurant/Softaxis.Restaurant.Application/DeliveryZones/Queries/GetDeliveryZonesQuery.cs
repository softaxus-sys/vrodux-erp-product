using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.DeliveryZones.Dtos;

namespace Softaxis.Restaurant.Application.DeliveryZones.Queries;

public sealed record GetDeliveryZonesQuery : IQuery<IReadOnlyList<DeliveryZoneDto>>;
