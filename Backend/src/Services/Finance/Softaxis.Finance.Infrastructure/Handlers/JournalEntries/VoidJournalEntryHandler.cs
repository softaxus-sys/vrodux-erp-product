using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.JournalEntries.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.JournalEntries;

internal sealed class VoidJournalEntryHandler(FinanceDbContext db) : ICommandHandler<VoidJournalEntryCommand>
{
    public async Task<Result> Handle(VoidJournalEntryCommand cmd, CancellationToken ct)
    {
        var entry = await db.JournalEntries.FindAsync([cmd.Id], ct);

        if (entry is null)
            return Result.Failure(Error.NotFoundById("JournalEntry", cmd.Id));

        if (entry.Status == "voided")
            return Result.Failure(Error.Custom("JournalEntry.Conflict", "Entry is already voided."));

        entry.Void();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
