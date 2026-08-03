using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Drivers.Dtos;

namespace Softaxis.Restaurant.Application.Drivers.Queries;

public sealed record GetDriversQuery(bool ActiveOnly = false) : IQuery<IReadOnlyList<DriverDto>>;
