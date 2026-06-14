using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.FiscalPeriods.Commands;
using Softaxis.Finance.Application.FiscalPeriods.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.FiscalPeriods;

internal sealed class ClosePeriodHandler(FinanceDbContext db) : ICommandHandler<ClosePeriodCommand, FiscalPeriodDto>
{
    public async Task<Result<FiscalPeriodDto>> Handle(ClosePeriodCommand cmd, CancellationToken ct)
    {
        var period = await db.FiscalPeriods.FirstOrDefaultAsync(x => x.PeriodCode == cmd.PeriodCode, ct);

        if (period is null)
        {
            period = new FiscalPeriod(cmd.PeriodCode);
            db.FiscalPeriods.Add(period);
        }

        if (period.Status == "closed")
            return Result.Failure<FiscalPeriodDto>(Error.Custom("FiscalPeriod.Conflict", $"Period {cmd.PeriodCode} is already closed."));

        period.Close(cmd.ClosedByName);
        await db.SaveChangesAsync(ct);

        return Result.Success(new FiscalPeriodDto(period.Id, period.PeriodCode, period.Status, period.ClosedByName, period.ClosedAt));
    }
}
