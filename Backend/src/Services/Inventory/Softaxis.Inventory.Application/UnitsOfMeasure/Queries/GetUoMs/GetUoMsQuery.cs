using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.UnitsOfMeasure.Queries.GetUoMs;

public sealed record GetUoMsQuery(string? Search, bool? IsActive) : IQuery<IReadOnlyList<UnitOfMeasureDto>>;
