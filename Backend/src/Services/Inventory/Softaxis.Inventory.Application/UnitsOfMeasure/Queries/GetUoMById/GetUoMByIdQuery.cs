using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Inventory.Application.DTOs;

namespace Softaxis.Inventory.Application.UnitsOfMeasure.Queries.GetUoMById;

public sealed record GetUoMByIdQuery(Guid Id) : IQuery<UnitOfMeasureDto>;
