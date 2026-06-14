using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Tax.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Tax;

internal sealed class FileTaxPeriodHandler(FinanceDbContext db) : ICommandHandler<FileTaxPeriodCommand>
{
    public async Task<Result> Handle(FileTaxPeriodCommand cmd, CancellationToken ct)
    {
        var period = await db.TaxPeriods.FindAsync([cmd.Id], ct);
        if (period is null)
            return Result.Failure(Error.NotFoundById("TaxPeriod", cmd.Id));

        if (period.Status is "filed" or "paid")
            return Result.Failure(Error.Custom("TaxPeriod.Conflict", "Period is already filed."));

        period.File(DateTime.UtcNow.ToString("yyyy-MM-dd"));
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
