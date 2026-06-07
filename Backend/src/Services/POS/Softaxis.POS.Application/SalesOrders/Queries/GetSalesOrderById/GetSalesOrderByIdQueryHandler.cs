using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.SalesOrders.Queries.GetSalesOrderById;

public sealed class GetSalesOrderByIdQueryHandler(ISalesOrderRepository soRepo)
    : IQueryHandler<GetSalesOrderByIdQuery, SalesOrderDto>
{
    public async Task<Result<SalesOrderDto>> Handle(GetSalesOrderByIdQuery query, CancellationToken ct)
    {
        var so = await soRepo.GetByIdAsync(query.Id, ct);
        if (so is null) return Result.Failure<SalesOrderDto>(Error.NotFoundById("SalesOrder", query.Id));

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
