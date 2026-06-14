using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Properties.Dtos;

namespace Softaxis.RealEstate.Application.Properties.Queries;

public sealed record GetPropertiesQuery : IQuery<IReadOnlyList<PropertyDto>>;

public sealed record GetPropertyByIdQuery(Guid Id) : IQuery<PropertyDto>;

public sealed record GetPropertiesSummaryQuery : IQuery<PropertiesSummaryDto>;
