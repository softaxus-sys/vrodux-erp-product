using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Customers.Commands;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Customers;

internal sealed class DeleteCrmCustomerHandler(CrmDbContext db) : ICommandHandler<DeleteCrmCustomerCommand>
{
    public async Task<Result> Handle(DeleteCrmCustomerCommand cmd, CancellationToken ct)
    {
        var c = await db.Customers.FindAsync([cmd.Id], ct);
        if (c is null)
            return Result.Failure(Error.NotFoundById("CrmCustomer", cmd.Id));

        c.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
