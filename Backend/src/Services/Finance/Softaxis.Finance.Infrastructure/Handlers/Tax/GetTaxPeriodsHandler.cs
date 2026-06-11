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
        var items = await db.TaxPeriods.AsNoTracking()
            .OrderByDescending(x => x.Period)
            .Select(x => new TaxPeriodDto(
                x.Id, x.Period, x.FromDate, x.ToDate, x.Status,
                x.OutputVat, x.InputVat, x.OutputVat - x.InputVat,
                x.DueDate, x.FiledDate, x.PaidDate, x.Penalty))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<TaxPeriodDto>>(items);
    }
}
