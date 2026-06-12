using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Invoices.Commands;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Invoices;

internal sealed class CancelInvoiceHandler(FinanceDbContext db) : ICommandHandler<CancelInvoiceCommand>
{
    public async Task<Result> Handle(CancelInvoiceCommand cmd, CancellationToken ct)
    {
        var invoice = await db.Invoices.FindAsync([cmd.Id], ct);

        if (invoice is null)
            return Result.Failure(Error.NotFoundById("Invoice", cmd.Id));

        await GlPoster.VoidAsync(db, invoice.JournalEntryId, ct);
        invoice.SetJournalEntryId(null);
        invoice.Cancel();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
