using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Suppliers.Commands;
using Softaxis.Finance.Application.Suppliers.Dtos;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Suppliers;

internal sealed class CreateSupplierHandler(FinanceDbContext db)
    : ICommandHandler<CreateSupplierCommand, SupplierDto>
{
    public async Task<Result<SupplierDto>> Handle(CreateSupplierCommand cmd, CancellationToken ct)
    {
        if (cmd.AccountId.HasValue)
        {
            var accountExists = await db.Accounts.AnyAsync(x => x.Id == cmd.AccountId.Value, ct);
            if (!accountExists)
                return Result.Failure<SupplierDto>(
                    Error.Custom("Supplier.AccountNotFound",
                        $"Account '{cmd.AccountId}' was not found."));
        }

        var supplier = new Supplier(cmd.Name, cmd.Email, cmd.Phone, cmd.Address, cmd.AccountId);
        if (!cmd.IsActive)
            supplier.Update(cmd.Name, cmd.Email, cmd.Phone, cmd.Address, cmd.AccountId, false);

        db.Suppliers.Add(supplier);
        await db.SaveChangesAsync(ct);

        Account? account = cmd.AccountId.HasValue
            ? await db.Accounts.AsNoTracking().FirstOrDefaultAsync(x => x.Id == cmd.AccountId.Value, ct)
            : null;

        return Result.Success(new SupplierDto(
            supplier.Id, supplier.Code, supplier.Name, supplier.Email, supplier.Phone, supplier.Address,
            supplier.AccountId, account?.AccountNumber, account?.Name,
            supplier.IsActive, supplier.CreatedAt, supplier.UpdatedAt));
    }
}
