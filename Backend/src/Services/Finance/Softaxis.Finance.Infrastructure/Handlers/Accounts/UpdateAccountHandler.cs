using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Accounts.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Accounts;

internal sealed class UpdateAccountHandler(FinanceDbContext db)
    : ICommandHandler<UpdateAccountCommand>
{
    public async Task<Result> Handle(
        UpdateAccountCommand cmd, CancellationToken ct)
    {
        var account = await db.Accounts.FindAsync([cmd.Id], ct);

        if (account is null)
            return Result.Failure(Error.NotFoundById(nameof(Account), cmd.Id));

        // Uniqueness check — same number on a different account is a conflict
        var duplicate = await db.Accounts.AnyAsync(
            x => x.AccountNumber == cmd.AccountNumber && x.Id != cmd.Id, ct);

        if (duplicate)
            return Result.Failure(
                Error.Custom("Account.Duplicate",
                    $"Account number '{cmd.AccountNumber}' is already used by another account."));

        account.Update(
            cmd.AccountNumber,
            cmd.Name,
            cmd.AccountType.ToLowerInvariant(),
            cmd.Description,
            cmd.ParentId,
            cmd.IsActive);

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
