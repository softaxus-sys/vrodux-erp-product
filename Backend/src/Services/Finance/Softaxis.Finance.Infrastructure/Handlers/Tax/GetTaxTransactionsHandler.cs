using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Tax.Dtos;
using Softaxis.Finance.Application.Tax.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Tax;

internal sealed class GetTaxTransactionsHandler(FinanceDbContext db) : IQueryHandler<GetTaxTransactionsQuery, IReadOnlyList<TaxTransactionDto>>
{
    public async Task<Result<IReadOnlyList<TaxTransactionDto>>> Handle(GetTaxTransactionsQuery query, CancellationToken ct)
    {
        var items = await db.TaxTransactions.AsNoTracking()
            .Include(x => x.Period)
            .OrderByDescending(x => x.Date)
            .Select(x => new TaxTransactionDto(
                x.Id, x.Date, x.Type, x.Reference,
                x.Amount, x.VatAmount, x.VatRate, x.Description,
                x.Period != null ? x.Period.Period : ""))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<TaxTransactionDto>>(items);
    }
}
