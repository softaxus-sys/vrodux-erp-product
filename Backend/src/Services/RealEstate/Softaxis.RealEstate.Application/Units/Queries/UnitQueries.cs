using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Units.Dtos;

namespace Softaxis.RealEstate.Application.Units.Queries;

public sealed record GetUnitsQuery(Guid? PropertyId) : IQuery<IReadOnlyList<UnitDto>>;

public sealed record GetUnitsSummaryQuery : IQuery<UnitsSummaryDto>;
