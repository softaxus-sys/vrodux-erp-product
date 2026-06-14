using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Accounts.Commands;
using Softaxis.Finance.Application.Accounts.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Accounts;

internal sealed class CreateAccountHandler(FinanceDbContext db)
    : ICommandHandler<CreateAccountCommand, AccountDto>
{
    public async Task<Result<AccountDto>> Handle(
        CreateAccountCommand cmd, CancellationToken ct)
    {
        // Uniqueness check — account number must be unique across non-deleted accounts
        var duplicate = await db.Accounts
            .AnyAsync(x => x.AccountNumber == cmd.AccountNumber, ct);

        if (duplicate)
            return Result.Failure<AccountDto>(
                Error.Custom("Account.Duplicate",
                    $"Account number '{cmd.AccountNumber}' already exists."));

        // Validate parent exists if provided
        if (cmd.ParentId.HasValue)
        {
            var parentExists = await db.Accounts.AnyAsync(x => x.Id == cmd.ParentId.Value, ct);
            if (!parentExists)
                return Result.Failure<AccountDto>(
                    Error.Custom("Account.ParentNotFound",
                        $"Parent account '{cmd.ParentId}' was not found."));
        }

        var accountType = await db.AccountTypes.FindAsync([cmd.AccountTypeId], ct);
        if (accountType is null)
            return Result.Failure<AccountDto>(
                Error.Custom("AccountType.NotFound", $"Account type '{cmd.AccountTypeId}' was not found."));

        var rootCode = accountType.ParentId is null
            ? accountType.Code
            : (await db.AccountTypes.FindAsync([accountType.ParentId.Value], ct))?.Code ?? accountType.Code;

        var account = new Account(
            cmd.AccountNumber,
            cmd.Name,
            rootCode,
            cmd.Description,
            cmd.ParentId);

        account.SetAccountTypeId(cmd.AccountTypeId);

        if (!cmd.IsActive)
            account.Update(cmd.AccountNumber, cmd.Name, rootCode, cmd.Description, cmd.ParentId, false);

        db.Accounts.Add(account);
        await db.SaveChangesAsync(ct);

        return Result.Success(new AccountDto(
            account.Id, account.AccountNumber, account.Name, account.AccountType,
            account.Description, account.ParentId, account.IsActive, account.Balance,
            account.CreatedAt, account.UpdatedAt, account.AccountTypeId));
    }
}
