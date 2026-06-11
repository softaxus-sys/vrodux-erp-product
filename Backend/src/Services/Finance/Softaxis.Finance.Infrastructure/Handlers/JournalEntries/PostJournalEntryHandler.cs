using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.JournalEntries.Commands;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.JournalEntries;

internal sealed class PostJournalEntryHandler(FinanceDbContext db) : ICommandHandler<PostJournalEntryCommand>
{
    public async Task<Result> Handle(PostJournalEntryCommand cmd, CancellationToken ct)
    {
        var entry = await db.JournalEntries
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id, ct);

        if (entry is null)
            return Result.Failure(Error.NotFoundById("JournalEntry", cmd.Id));

        if (entry.Status != "draft")
            return Result.Failure(Error.Custom("JournalEntry.Conflict", "Only draft entries can be posted."));

        if (!entry.IsBalanced)
            return Result.Failure(Error.Custom("JournalEntry.Conflict",
                $"Entry is not balanced. Debit: {entry.TotalDebit}, Credit: {entry.TotalCredit}"));

        entry.Post();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
