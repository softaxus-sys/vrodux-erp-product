using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Tax.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Tax;

internal sealed class DeleteTaxPeriodHandler(FinanceDbContext db) : ICommandHandler<DeleteTaxPeriodCommand>
{
    public async Task<Result> Handle(DeleteTaxPeriodCommand cmd, CancellationToken ct)
    {
        var period = await db.TaxPeriods.Include(p => p.Transactions).FirstOrDefaultAsync(p => p.Id == cmd.Id, ct);
        if (period is null)
            return Result.Failure(Error.NotFoundById("TaxPeriod", cmd.Id));

        if (period.Status is "filed" or "paid")
            return Result.Failure(Error.Custom("TaxPeriod.Conflict",
                $"The {period.Period} return has been {period.Status} and cannot be deleted. Corrections belong in a later return or a voluntary disclosure."));

        // VAT returns reference the period by id only (no FK), so they are handled here.
        var returns = await db.VatReturns.Where(r => r.TaxPeriodId == period.Id && !r.IsDeleted).ToListAsync(ct);
        if (returns.Any(r => VatReturnStatus.Final.Contains(r.Status)))
            return Result.Failure(Error.Custom("TaxPeriod.Conflict",
                $"An FTA return for {period.Period} has already been submitted or filed on EmaraTax, so the period cannot be deleted."));

        // Drafts/approved/ready returns were never declared — kept as soft-deleted history, not destroyed.
        foreach (var r in returns) r.Delete();

        db.TaxPeriods.Remove(period);   // legacy tax_transactions cascade
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
