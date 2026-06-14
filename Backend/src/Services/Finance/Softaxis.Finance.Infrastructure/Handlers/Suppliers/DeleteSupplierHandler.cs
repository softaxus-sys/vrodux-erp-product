using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Suppliers.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Suppliers;

internal sealed class DeleteSupplierHandler(FinanceDbContext db)
    : ICommandHandler<DeleteSupplierCommand>
{
    public async Task<Result> Handle(DeleteSupplierCommand cmd, CancellationToken ct)
    {
        var supplier = await db.Suppliers.FindAsync([cmd.Id], ct);
        if (supplier is null)
            return Result.Failure(Error.NotFoundById(nameof(Supplier), cmd.Id));

        var hasExpenses = await db.Expenses.AnyAsync(x => x.SupplierId == cmd.Id, ct);
        if (hasExpenses)
            return Result.Failure(Error.Custom(
                "Supplier.HasTransactions",
                "Cannot delete a supplier that has expenses. Deactivate it instead."));

        supplier.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
