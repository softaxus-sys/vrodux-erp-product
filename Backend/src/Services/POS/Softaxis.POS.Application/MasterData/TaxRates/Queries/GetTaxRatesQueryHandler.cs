using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.TaxRates.Queries;

public sealed record GetTaxRatesQuery : IQuery<List<TaxRateDto>>;

public sealed class GetTaxRatesQueryHandler(ITaxRateRepository repo)
    : IQueryHandler<GetTaxRatesQuery, List<TaxRateDto>>
{
    public async Task<Result<List<TaxRateDto>>> Handle(GetTaxRatesQuery q, CancellationToken ct)
    {
        var items = await repo.GetAllAsync(ct);
        var dtos  = items.Select(t => new TaxRateDto(
            t.Id, t.Name, t.Code, t.Rate, t.AppliesTo,
            t.Description, t.IsDefault, t.IsActive, t.IsSystem,
            t.CreatedAt, t.UpdatedAt)).ToList();
        return Result.Success(dtos);
    }
}
