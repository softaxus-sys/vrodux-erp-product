using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.FiscalPeriods.Dtos;
using Softaxis.Finance.Application.FiscalPeriods.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.FiscalPeriods;

internal sealed class GetFiscalPeriodsHandler(FinanceDbContext db)
    : IQueryHandler<GetFiscalPeriodsQuery, IReadOnlyList<FiscalPeriodDto>>
{
    public async Task<Result<IReadOnlyList<FiscalPeriodDto>>> Handle(GetFiscalPeriodsQuery query, CancellationToken ct)
    {
        var year = query.Year ?? DateTime.UtcNow.Year;
        var prefix = year.ToString("0000");

        var existing = await db.FiscalPeriods.AsNoTracking()
            .Where(x => x.PeriodCode.StartsWith(prefix))
            .ToDictionaryAsync(x => x.PeriodCode, ct);

        var result = new List<FiscalPeriodDto>(12);
        for (var month = 1; month <= 12; month++)
        {
            var code = $"{prefix}-{month:00}";
            if (existing.TryGetValue(code, out var period))
                result.Add(new FiscalPeriodDto(period.Id, period.PeriodCode, period.Status, period.ClosedByName, period.ClosedAt));
            else
                result.Add(new FiscalPeriodDto(Guid.Empty, code, "open", null, null));
        }

        return Result.Success<IReadOnlyList<FiscalPeriodDto>>(result);
    }
}
