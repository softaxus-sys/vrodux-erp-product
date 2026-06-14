using Softaxis.Finance.Application.JournalEntries.Dtos;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Handlers.JournalEntries;

internal static class JournalEntryMappings
{
    public static JournalEntryDto ToDto(JournalEntry e) => new(
        e.Id, e.EntryNumber, e.Date, e.Description, e.Reference, e.Status, e.Notes,
        e.TotalDebit, e.TotalCredit, e.IsBalanced,
        e.Lines.Select(l => new JournalLineDto(
            l.Id, l.AccountId, l.AccountName,
            l.DebitAmount, l.CreditAmount, l.Description)).ToList(),
        e.CreatedAt, e.UpdatedAt);
}
