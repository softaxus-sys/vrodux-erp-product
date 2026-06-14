using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Customers.Commands;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Customers;

internal sealed class DeleteCustomerHandler(FinanceDbContext db)
    : ICommandHandler<DeleteCustomerCommand>
{
    public async Task<Result> Handle(DeleteCustomerCommand cmd, CancellationToken ct)
    {
        var customer = await db.Customers.FindAsync([cmd.Id], ct);
        if (customer is null)
            return Result.Failure(Error.NotFoundById(nameof(Customer), cmd.Id));

        var hasInvoices = await db.Invoices.AnyAsync(x => x.CustomerId == cmd.Id, ct);
        if (hasInvoices)
            return Result.Failure(Error.Custom(
                "Customer.HasTransactions",
                "Cannot delete a customer that has invoices. Deactivate it instead."));

        customer.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
