using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.GeneralLedger.Dtos;
using Softaxis.Finance.Application.GeneralLedger.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;

internal sealed class GetAccountLedgerHandler(FinanceDbContext db) : IQueryHandler<GetAccountLedgerQuery, AccountLedgerDto>
{
    public async Task<Result<AccountLedgerDto>> Handle(GetAccountLedgerQuery query, CancellationToken ct)
    {
        var account = await db.Accounts.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == query.AccountId && !x.IsDeleted, ct);

        if (account is null)
            return Result.Failure<AccountLedgerDto>(Error.NotFoundById("Account", query.AccountId));

        var lines = await db.JournalLines.AsNoTracking()
            .Where(l => l.AccountId == query.AccountId && l.JournalEntry!.Status == "posted")
            .Select(l => new
            {
                l.JournalEntry!.Date,
                l.JournalEntry!.EntryNumber,
                l.JournalEntry!.Reference,
                Description = l.Description ?? l.JournalEntry!.Description,
                l.DebitAmount,
                l.CreditAmount,
            })
            .ToListAsync(ct);

        var openingBalance = account.Balance;
        if (!string.IsNullOrWhiteSpace(query.From))
            openingBalance += lines
                .Where(l => string.CompareOrdinal(l.Date, query.From) < 0)
                .Sum(l => l.DebitAmount - l.CreditAmount);

        var inRange = lines
            .Where(l => string.IsNullOrWhiteSpace(query.From) || string.CompareOrdinal(l.Date, query.From) >= 0)
            .Where(l => string.IsNullOrWhiteSpace(query.To) || string.CompareOrdinal(l.Date, query.To) <= 0)
            .OrderBy(l => l.Date)
            .ThenBy(l => l.EntryNumber)
            .ToList();

        var entries = new List<AccountLedgerEntryDto>(inRange.Count);
        var running = openingBalance;
        foreach (var l in inRange)
        {
            running += l.DebitAmount - l.CreditAmount;
            entries.Add(new AccountLedgerEntryDto(l.Date, l.EntryNumber, l.Reference, l.Description, l.DebitAmount, l.CreditAmount, running));
        }

        var totalDebits  = inRange.Sum(l => l.DebitAmount);
        var totalCredits = inRange.Sum(l => l.CreditAmount);

        var dto = new AccountLedgerDto(
            account.Id, account.AccountNumber, account.Name, account.AccountType,
            query.From, query.To,
            openingBalance, entries, totalDebits, totalCredits,
            openingBalance + totalDebits - totalCredits);

        return Result.Success(dto);
    }
}
