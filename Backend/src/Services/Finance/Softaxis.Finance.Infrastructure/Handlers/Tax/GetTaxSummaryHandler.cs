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

        return Result.Success(new TaxSummaryDto(
            current?.OutputVat ?? 0m,
            current?.InputVat ?? 0m,
            current?.NetVat ?? 0m,
            periods.Where(p => p.Status == "paid").Sum(p => p.NetVat),
            current?.DueDate ?? "",
            current?.Period ?? "",
            "TRN-100234567890003"));
    }
}
