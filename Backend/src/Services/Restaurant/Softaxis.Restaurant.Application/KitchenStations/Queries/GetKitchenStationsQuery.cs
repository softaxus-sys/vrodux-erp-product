using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.KitchenStations.Dtos;

namespace Softaxis.Restaurant.Application.KitchenStations.Queries;

public sealed record GetKitchenStationsQuery : IQuery<IReadOnlyList<KitchenStationDto>>;
