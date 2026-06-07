using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.SalesOrders.Commands.DeleteSalesOrder;

public sealed class DeleteSalesOrderCommandHandler(
    ISalesOrderRepository soRepo,
    IUnitOfWork           uow)
    : ICommandHandler<DeleteSalesOrderCommand>
{
    public async Task<Result> Handle(DeleteSalesOrderCommand cmd, CancellationToken ct)
    {
        var so = await soRepo.GetByIdAsync(cmd.Id, ct);
        if (so is null) return Result.Failure(Error.NotFoundById("SalesOrder", cmd.Id));

        so.Delete();
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
