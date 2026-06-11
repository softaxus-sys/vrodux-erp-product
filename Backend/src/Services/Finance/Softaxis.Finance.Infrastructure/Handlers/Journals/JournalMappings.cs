using Softaxis.Finance.Application.Journals.Dtos;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Handlers.Journals;

internal static class JournalMappings
{
    public static JournalDto ToDto(JournalEntry e) => new(
        e.Id, e.EntryNumber, e.Date, e.Description, e.Reference, e.Status, e.Notes,
        e.TotalDebit, e.TotalCredit, e.IsBalanced,
        e.Date.Length >= 7 ? e.Date[..7] : e.Date,
        "System",
        e.Lines.Select(l => new JournalLineDto(
            l.Id,
            l.Account?.AccountNumber ?? l.AccountId.ToString()[..8],
            l.AccountName,
            l.DebitAmount,
            l.CreditAmount,
            l.Description)).ToList(),
        e.CreatedAt, e.UpdatedAt);
}
