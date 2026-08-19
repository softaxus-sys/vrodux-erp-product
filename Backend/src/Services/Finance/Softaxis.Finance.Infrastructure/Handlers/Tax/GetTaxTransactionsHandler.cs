using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Tax.Dtos;
using Softaxis.Finance.Application.Tax.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Tax;

/// <summary>
/// Derived from sales invoices + purchase bills (see <see cref="VatLedger"/>) rather than the
/// legacy <c>tax_transactions</c> table, which only the demo seed ever wrote to.
/// </summary>
internal sealed class GetTaxTransactionsHandler(FinanceDbContext db) : IQueryHandler<GetTaxTransactionsQuery, IReadOnlyList<TaxTransactionDto>>
{
    public async Task<Result<IReadOnlyList<TaxTransactionDto>>> Handle(GetTaxTransactionsQuery query, CancellationToken ct)
    {
        var rows = await VatLedger.BuildAsync(db, ct);
        return Result.Success<IReadOnlyList<TaxTransactionDto>>(rows);
    }
}
