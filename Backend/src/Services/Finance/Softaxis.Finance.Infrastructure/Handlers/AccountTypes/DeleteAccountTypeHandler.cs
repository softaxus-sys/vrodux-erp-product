using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.AccountTypes.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.AccountTypes;

internal sealed class DeleteAccountTypeHandler(FinanceDbContext db)
    : ICommandHandler<DeleteAccountTypeCommand>
{
    public async Task<Result> Handle(DeleteAccountTypeCommand cmd, CancellationToken ct)
    {
        var entity = await db.AccountTypes.FindAsync([cmd.Id], ct);

        if (entity is null)
            return Result.Failure(Error.NotFoundById(nameof(AccountType), cmd.Id));

        var hasSubtypes = await db.AccountTypes.AnyAsync(x => x.ParentId == cmd.Id, ct);
        if (hasSubtypes)
            return Result.Failure(Error.Custom(
                "AccountType.Conflict", "Cannot delete a type that has subtypes. Delete its subtypes first."));

        var hasAccounts = await db.Accounts.AnyAsync(x => x.AccountTypeId == cmd.Id, ct);
        if (hasAccounts)
            return Result.Failure(Error.Custom(
                "AccountType.Conflict", "Cannot delete a type that is in use by one or more accounts."));

        db.AccountTypes.Remove(entity);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
