using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.AccountTypes.Commands;
using Softaxis.Finance.Application.Lookups.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.AccountTypes;

internal sealed class UpdateAccountTypeHandler(FinanceDbContext db)
    : ICommandHandler<UpdateAccountTypeCommand, AccountTypeDto>
{
    public async Task<Result<AccountTypeDto>> Handle(UpdateAccountTypeCommand cmd, CancellationToken ct)
    {
        var entity = await db.AccountTypes.FindAsync([cmd.Id], ct);

        if (entity is null)
            return Result.Failure<AccountTypeDto>(Error.NotFoundById(nameof(AccountType), cmd.Id));

        entity.Rename(cmd.Name);

        // Normal balance only applies to root types — subtypes inherit their parent's.
        if (entity.ParentId is null && cmd.NormalBalance is not null)
            entity.SetNormalBalance(cmd.NormalBalance);

        entity.SetActive(cmd.IsActive);

        await db.SaveChangesAsync(ct);

        return Result.Success(new AccountTypeDto(
            entity.Id, entity.Code, entity.Name, entity.NormalBalance,
            entity.ParentId, entity.SortOrder, entity.IsActive));
    }
}
