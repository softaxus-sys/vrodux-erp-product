using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.JournalEntries.Commands;
using Softaxis.Finance.Application.JournalEntries.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.JournalEntries;

internal sealed class CreateJournalEntryHandler(FinanceDbContext db) : ICommandHandler<CreateJournalEntryCommand, JournalEntryDto>
{
    public async Task<Result<JournalEntryDto>> Handle(CreateJournalEntryCommand cmd, CancellationToken ct)
    {
        if (await GlPoster.IsPeriodClosedAsync(db, cmd.Date, ct))
            return Result.Failure<JournalEntryDto>(Error.Custom("FiscalPeriod.Locked", $"The fiscal period for {cmd.Date} is closed for posting."));

        var entry = new JournalEntry(
            cmd.Date, cmd.Description, cmd.Reference, cmd.Notes,
            cmd.CreatedByUserId, cmd.CreatedByName);

        foreach (var l in cmd.Lines)
            entry.Lines.Add(new JournalEntryLine(
                entry.Id, l.AccountId, l.AccountName,
                l.DebitAmount, l.CreditAmount, l.Description));

        if (!entry.IsBalanced)
            return Result.Failure<JournalEntryDto>(Error.Custom("JournalEntry.Unbalanced",
                $"Entry is not balanced. Debit: {entry.TotalDebit}, Credit: {entry.TotalCredit}"));

        db.JournalEntries.Add(entry);
        await db.SaveChangesAsync(ct);

        return Result.Success(JournalEntryMappings.ToDto(entry));
    }
}
