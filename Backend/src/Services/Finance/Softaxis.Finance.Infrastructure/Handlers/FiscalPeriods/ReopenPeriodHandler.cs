using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.FiscalPeriods.Commands;
using Softaxis.Finance.Application.FiscalPeriods.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.FiscalPeriods;

internal sealed class ReopenPeriodHandler(FinanceDbContext db) : ICommandHandler<ReopenPeriodCommand, FiscalPeriodDto>
{
    public async Task<Result<FiscalPeriodDto>> Handle(ReopenPeriodCommand cmd, CancellationToken ct)
    {
        var period = await db.FiscalPeriods.FirstOrDefaultAsync(x => x.PeriodCode == cmd.PeriodCode, ct);

        if (period is null || period.Status == "open")
            return Result.Failure<FiscalPeriodDto>(Error.Custom("FiscalPeriod.Conflict", $"Period {cmd.PeriodCode} is not closed."));

        period.Reopen();
        await db.SaveChangesAsync(ct);

        return Result.Success(new FiscalPeriodDto(period.Id, period.PeriodCode, period.Status, period.ClosedByName, period.ClosedAt));
    }
}
