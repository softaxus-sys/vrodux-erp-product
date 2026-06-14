using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Sales.Application.DeliveryChallans.Dtos;
using Softaxis.Sales.Application.DeliveryChallans.Queries;
using Softaxis.Sales.Infrastructure.Persistence;

namespace Softaxis.Sales.Infrastructure.Handlers.DeliveryChallans;

internal sealed class GetDeliveryChallanByIdHandler(SalesDbContext db)
    : IQueryHandler<GetDeliveryChallanByIdQuery, DeliveryChallanDto>
{
    public async Task<Result<DeliveryChallanDto>> Handle(
        GetDeliveryChallanByIdQuery query, CancellationToken ct)
    {
        var challan = await db.DeliveryChallans
            .AsNoTracking()
            .Include(x => x.SalesOrder)
            .Include(x => x.Customer)
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == query.Id, ct);

        if (challan is null)
            return Result.Failure<DeliveryChallanDto>(
                Error.Custom("DeliveryChallan.NotFound", $"Delivery challan '{query.Id}' was not found."));

        return Result.Success(new DeliveryChallanDto(
            challan.Id, challan.ChallanNumber, challan.SalesOrderId,
            challan.SalesOrder?.OrderNumber ?? "Unknown",
            challan.CustomerId, challan.Customer?.Name ?? challan.SalesOrder?.CustomerName ?? "Walk-in Customer",
            challan.ChallanDate, challan.DriverName, challan.Notes, challan.Status,
            challan.Items.Select(i => new DeliveryChallanItemDto(
                i.Id, i.SalesOrderItemId, i.ProductId, i.Description,
                i.OrderedQuantity, i.DeliveredQuantity, i.UnitPrice, i.LineTotal)).ToList(),
            challan.CreatedAt, challan.UpdatedAt));
    }
}
