using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.UnitsOfMeasure.Queries.GetUoMById;

public sealed class GetUoMByIdQueryHandler(IUnitOfMeasureRepository uomRepo)
    : IQueryHandler<GetUoMByIdQuery, UnitOfMeasureDto>
{
    public async Task<Result<UnitOfMeasureDto>> Handle(GetUoMByIdQuery query, CancellationToken ct)
    {
        var u = await uomRepo.GetByIdAsync(query.Id, ct);
        if (u is null)
            return Result.Failure<UnitOfMeasureDto>(
                Error.Custom("UoM.NotFound", $"Unit of measure '{query.Id}' not found."));

        return Result.Success(new UnitOfMeasureDto(
            u.Id, u.Name, u.Symbol, u.Description,
            u.IsActive, u.Products.Count,
            u.CreatedAt, u.UpdatedAt));
    }
}
