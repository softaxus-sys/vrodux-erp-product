using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Tax.Commands;
using Softaxis.Finance.Application.Tax.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Tax;

internal sealed class CreateTaxPeriodHandler(FinanceDbContext db) : ICommandHandler<CreateTaxPeriodCommand, TaxPeriodDto>
{
    public async Task<Result<TaxPeriodDto>> Handle(CreateTaxPeriodCommand cmd, CancellationToken ct)
    {
        var exists = await db.TaxPeriods.AsNoTracking()
            .AnyAsync(x => x.Period == cmd.Period, ct);

        if (exists)
            return Result.Failure<TaxPeriodDto>(
                Error.Custom("TaxPeriod.Duplicate", $"A VAT return for {cmd.Period} already exists."));

        var period = new TaxPeriod(cmd.Period.Trim(), cmd.FromDate, cmd.ToDate, cmd.DueDate);
        db.TaxPeriods.Add(period);
        await db.SaveChangesAsync(ct);

        return Result.Success(new TaxPeriodDto(
            period.Id, period.Period, period.FromDate, period.ToDate, period.Status,
            period.OutputVat, period.InputVat, period.NetVat,
            period.DueDate, period.FiledDate, period.PaidDate, period.Penalty));
    }
}
