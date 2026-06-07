using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Accounts.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Accounts;

internal sealed class DeleteAccountHandler(FinanceDbContext db)
    : ICommandHandler<DeleteAccountCommand>
{
    public async Task<Result> Handle(
        DeleteAccountCommand cmd, CancellationToken ct)
    {
        var account = await db.Accounts.FindAsync([cmd.Id], ct);

        if (account is null)
            return Result.Failure(Error.NotFoundById(nameof(Account), cmd.Id));

        // Guard: don't allow deletion if the account has journal entry lines
        var hasJournalLines = await db.JournalLines
            .AnyAsync(x => x.AccountId == cmd.Id, ct);

        if (hasJournalLines)
            return Result.Failure(Error.Custom(
                "Account.HasTransactions",
                "Cannot delete an account that has journal entry lines. Deactivate it instead."));

        account.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
