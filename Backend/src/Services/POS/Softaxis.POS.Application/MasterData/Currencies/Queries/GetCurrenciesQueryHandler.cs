using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.MasterData.Currencies.Queries;

public sealed record GetCurrenciesQuery : IQuery<List<CurrencyDto>>;

public sealed class GetCurrenciesQueryHandler(ICurrencyRepository repo)
    : IQueryHandler<GetCurrenciesQuery, List<CurrencyDto>>
{
    public async Task<Result<List<CurrencyDto>>> Handle(GetCurrenciesQuery q, CancellationToken ct)
    {
        var items = await repo.GetAllAsync(ct);
        var dtos  = items.Select(c => new CurrencyDto(
            c.Id, c.Code, c.Name, c.Symbol,
            c.ExchangeRate, c.IsDefault, c.IsActive, c.IsSystem,
            c.CreatedAt, c.UpdatedAt)).ToList();
        return Result.Success(dtos);
    }
}
