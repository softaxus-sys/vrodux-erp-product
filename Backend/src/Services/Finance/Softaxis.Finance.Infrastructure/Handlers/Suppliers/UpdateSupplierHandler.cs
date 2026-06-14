using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Suppliers.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Suppliers;

internal sealed class UpdateSupplierHandler(FinanceDbContext db)
    : ICommandHandler<UpdateSupplierCommand>
{
    public async Task<Result> Handle(UpdateSupplierCommand cmd, CancellationToken ct)
    {
        var supplier = await db.Suppliers.FindAsync([cmd.Id], ct);
        if (supplier is null)
            return Result.Failure(Error.NotFoundById(nameof(Supplier), cmd.Id));

        if (cmd.AccountId.HasValue)
        {
            var accountExists = await db.Accounts.AnyAsync(x => x.Id == cmd.AccountId.Value, ct);
            if (!accountExists)
                return Result.Failure(
                    Error.Custom("Supplier.AccountNotFound",
                        $"Account '{cmd.AccountId}' was not found."));
        }

        supplier.Update(cmd.Name, cmd.Email, cmd.Phone, cmd.Address, cmd.AccountId, cmd.IsActive);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
