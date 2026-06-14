using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Tax.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Tax;

internal sealed class PayTaxPeriodHandler(FinanceDbContext db) : ICommandHandler<PayTaxPeriodCommand>
{
    public async Task<Result> Handle(PayTaxPeriodCommand cmd, CancellationToken ct)
    {
        var period = await db.TaxPeriods.FindAsync([cmd.Id], ct);
        if (period is null)
            return Result.Failure(Error.NotFoundById("TaxPeriod", cmd.Id));

        if (period.Status == "paid")
            return Result.Failure(Error.Custom("TaxPeriod.Conflict", "Period is already paid."));

        if (period.Status == "open")
            return Result.Failure(Error.Custom("TaxPeriod.Conflict", "File the return before recording payment."));

        period.MarkPaid(DateTime.UtcNow.ToString("yyyy-MM-dd"));
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
