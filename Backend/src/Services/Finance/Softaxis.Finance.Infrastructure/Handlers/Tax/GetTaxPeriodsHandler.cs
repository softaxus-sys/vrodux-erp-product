using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Tax.Dtos;
using Softaxis.Finance.Application.Tax.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Tax;

internal sealed class GetTaxPeriodsHandler(FinanceDbContext db) : IQueryHandler<GetTaxPeriodsQuery, IReadOnlyList<TaxPeriodDto>>
{
    public async Task<Result<IReadOnlyList<TaxPeriodDto>>> Handle(GetTaxPeriodsQuery query, CancellationToken ct)
    {
        var periods = await db.TaxPeriods.AsNoTracking()
            .OrderByDescending(x => x.Period)
            .ToListAsync(ct);

        // Output/input VAT per period is computed from the invoices and bills falling inside it —
        // the stored TaxPeriod.OutputVat/InputVat columns are never written outside the demo seed
        // and would report every period as 0.
        var rows = await VatLedger.BuildAsync(db, ct);

        var items = periods.Select(x =>
        {
            var inPeriod = rows.Where(r => string.CompareOrdinal(r.Date, x.FromDate) >= 0
                                        && string.CompareOrdinal(r.Date, x.ToDate) <= 0);
            var (output, input, net) = VatLedger.Totals(inPeriod);
            return new TaxPeriodDto(
                x.Id, x.Period, x.FromDate, x.ToDate, x.Status,
                output, input, net,
                x.DueDate, x.FiledDate, x.PaidDate, x.Penalty);
        }).ToList();

        return Result.Success<IReadOnlyList<TaxPeriodDto>>(items);
    }
}
