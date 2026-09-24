using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.DTOs;
using Softaxis.Inventory.Domain.Repositories;

namespace Softaxis.Inventory.Application.UnitsOfMeasure.Queries.GetUoMs;

public sealed class GetUoMsQueryHandler(IUnitOfMeasureRepository uomRepo)
    : IQueryHandler<GetUoMsQuery, IReadOnlyList<UnitOfMeasureDto>>
{
    public async Task<Result<IReadOnlyList<UnitOfMeasureDto>>> Handle(GetUoMsQuery query, CancellationToken ct)
    {
        // Lazy per-tenant seed: a new workspace starts with a usable starter set rather than an
        // empty list that blocks the product form until someone invents an entry by hand.
        await uomRepo.EnsureDefaultsAsync(ct);

        var uoms = await uomRepo.GetAllAsync(query.Search, query.IsActive, ct);
        var dtos = uoms.Select(u => new UnitOfMeasureDto(
            u.Id, u.Name, u.Symbol, u.Description,
            u.IsActive, u.Products.Count,
            u.CreatedAt, u.UpdatedAt)).ToList();

        return Result.Success<IReadOnlyList<UnitOfMeasureDto>>(dtos);
    }
}
