using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.SalesOrders.Commands.CreateSalesOrder;

public sealed class CreateSalesOrderCommandHandler(
    ISalesOrderRepository soRepo,
    IUnitOfWork           uow)
    : ICommandHandler<CreateSalesOrderCommand, SalesOrderDto>
{
    public async Task<Result<SalesOrderDto>> Handle(CreateSalesOrderCommand cmd, CancellationToken ct)
    {
        var so = new SalesOrder(cmd.CustomerId, cmd.CustomerName, cmd.Notes, cmd.ExpectedDate);

        foreach (var item in cmd.Items)
            so.Items.Add(new SalesOrderItem(
                so.Id, item.ProductId, item.Description,
                item.Quantity, item.UnitPrice, item.DiscountPercent, item.TaxRate));

        soRepo.Add(so);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new SalesOrderDto(
            so.Id, so.OrderNumber, so.CustomerId, so.CustomerName,
            so.Status, so.Notes, so.ExpectedDate, so.DeliveredDate,
            so.SubTotal, so.TaxAmount, so.Total,
            so.Items.Select(i => new SalesOrderItemDto(
                i.Id, i.ProductId, i.Description, i.Quantity,
                i.UnitPrice, i.DiscountPercent, i.TaxRate, i.LineTotal)).ToList(),
            so.CreatedAt, so.UpdatedAt));
    }
}
