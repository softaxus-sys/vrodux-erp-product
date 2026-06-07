using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.SalesOrders.Commands.UpdateSalesOrder;

public sealed class UpdateSalesOrderCommandHandler(
    ISalesOrderRepository soRepo,
    IUnitOfWork           uow)
    : ICommandHandler<UpdateSalesOrderCommand>
{
    public async Task<Result> Handle(UpdateSalesOrderCommand cmd, CancellationToken ct)
    {
        var so = await soRepo.GetByIdAsync(cmd.Id, ct);
        if (so is null) return Result.Failure(Error.NotFoundById("SalesOrder", cmd.Id));

        so.Update(cmd.CustomerId, cmd.CustomerName, cmd.Notes, cmd.ExpectedDate, cmd.Status);

        so.Items.Clear();
        foreach (var item in cmd.Items)
            so.Items.Add(new SalesOrderItem(
                so.Id, item.ProductId, item.Description,
                item.Quantity, item.UnitPrice, item.DiscountPercent, item.TaxRate));

        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
