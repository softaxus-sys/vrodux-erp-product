using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Tax.Dtos;
using Softaxis.Finance.Application.Tax.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Tax;

internal sealed class GetTaxSummaryHandler(FinanceDbContext db) : IQueryHandler<GetTaxSummaryQuery, TaxSummaryDto>
{
    public async Task<Result<TaxSummaryDto>> Handle(GetTaxSummaryQuery query, CancellationToken ct)
    {
        var periods = await db.TaxPeriods.AsNoTracking()
            .OrderByDescending(x => x.Period)
            .ToListAsync(ct);

        var current = periods.FirstOrDefault(p => p.Status == "open") ?? periods.FirstOrDefault();

        // Figures come from the actual invoices/bills, not TaxPeriod.OutputVat/InputVat — those
        // stored fields are never populated by anything in the request path, so they always read 0.
        var rows = await VatLedger.BuildAsync(db, ct);

        // Scope to the current period when one is declared; otherwise report across everything so
        // a tenant that has not set up periods yet still sees its VAT position.
        var scoped = current is null
            ? rows
            : rows.Where(r => string.CompareOrdinal(r.Date, current.FromDate) >= 0
                           && string.CompareOrdinal(r.Date, current.ToDate) <= 0).ToList();

        var (output, input, net) = VatLedger.Totals(scoped);

        // VAT already settled: periods marked paid, valued from their own date ranges.
        var ytdPaid = 0m;
        foreach (var p in periods.Where(p => p.Status == "paid"))
        {
            var inPeriod = rows.Where(r => string.CompareOrdinal(r.Date, p.FromDate) >= 0
                                        && string.CompareOrdinal(r.Date, p.ToDate) <= 0);
            ytdPaid += VatLedger.Totals(inPeriod).Net;
        }

        return Result.Success(new TaxSummaryDto(
            output, input, net,
            ytdPaid,
            current?.DueDate ?? "",
            current?.Period ?? "",
            // The tenant's own TRN is not captured anywhere yet. This used to return a hardcoded
            // demo TRN to EVERY tenant — a legal identifier on VAT returns must never be invented,
            // so return empty and let the UI prompt for it once there is somewhere to store it.
            ""));
    }
}
