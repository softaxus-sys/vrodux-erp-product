using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.JournalEntries.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.JournalEntries;

internal sealed class DeleteJournalEntryHandler(FinanceDbContext db) : ICommandHandler<DeleteJournalEntryCommand>
{
    public async Task<Result> Handle(DeleteJournalEntryCommand cmd, CancellationToken ct)
    {
        var entry = await db.JournalEntries.FindAsync([cmd.Id], ct);

        if (entry is null)
            return Result.Failure(Error.NotFoundById("JournalEntry", cmd.Id));

        if (entry.Status == "posted")
            return Result.Failure(Error.Custom("JournalEntry.Conflict", "Posted journal entries cannot be deleted. Void instead."));

        entry.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
