using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Lookups.Dtos;
using Softaxis.Finance.Application.Lookups.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Lookups;

internal sealed class GetCurrenciesHandler(FinanceDbContext db)
    : IQueryHandler<GetCurrenciesQuery, IReadOnlyList<CurrencyDto>>
{
    public async Task<Result<IReadOnlyList<CurrencyDto>>> Handle(GetCurrenciesQuery query, CancellationToken ct)
    {
        var items = await db.Currencies
            .AsNoTracking()
            .Where(x => x.IsActive)
            .OrderByDescending(x => x.IsBaseCurrency)
            .ThenBy(x => x.Code)
            .Select(x => new CurrencyDto(x.Id, x.Code, x.Name, x.Symbol, x.DecimalPlaces, x.IsBaseCurrency))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<CurrencyDto>>(items);
    }
}
