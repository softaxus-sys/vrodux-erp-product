using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Sales.Application.DeliveryChallans.Commands;
using Softaxis.Sales.Application.DeliveryChallans.Dtos;
using Softaxis.Sales.Domain.Entities;
using Softaxis.Sales.Infrastructure.Persistence;

namespace Softaxis.Sales.Infrastructure.Handlers.DeliveryChallans;

internal sealed class CreateDeliveryChallanHandler(SalesDbContext db)
    : ICommandHandler<CreateDeliveryChallanCommand, DeliveryChallanDto>
{
    public async Task<Result<DeliveryChallanDto>> Handle(
        CreateDeliveryChallanCommand cmd, CancellationToken ct)
    {
        var order = await db.SalesOrders
            .Include(x => x.Customer)
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == cmd.SalesOrderId, ct);

        if (order is null)
            return Result.Failure<DeliveryChallanDto>(
                Error.Custom("DeliveryChallan.NotFound", $"Sales order '{cmd.SalesOrderId}' was not found."));

        if (order.Status is "cancelled")
            return Result.Failure<DeliveryChallanDto>(
                Error.Custom("DeliveryChallan.Conflict", "Cannot record a delivery against a cancelled sales order."));

        var challan = new DeliveryChallan(order.Id, order.CustomerId, cmd.ChallanDate, cmd.DriverName, cmd.Notes);

        foreach (var item in cmd.Items)
            challan.AddItem(item.SalesOrderItemId, item.ProductId, item.Description,
                item.OrderedQuantity, item.DeliveredQuantity, item.UnitPrice);

        db.DeliveryChallans.Add(challan);

        // Determine cumulative delivered quantities per sales order item across all challans (including this one)
        var previousDelivered = await db.DeliveryChallanItems
            .Where(i => i.DeliveryChallan!.SalesOrderId == order.Id
                     && i.DeliveryChallan!.Status == "posted"
                     && i.SalesOrderItemId != null)
            .GroupBy(i => i.SalesOrderItemId)
            .Select(g => new { SalesOrderItemId = g.Key, Total = g.Sum(x => x.DeliveredQuantity) })
            .ToListAsync(ct);

        var newDelivered = cmd.Items
            .Where(i => i.SalesOrderItemId is not null)
            .GroupBy(i => i.SalesOrderItemId)
            .Select(g => new { SalesOrderItemId = g.Key, Total = g.Sum(x => x.DeliveredQuantity) });

        var cumulative = order.Items.ToDictionary(i => i.Id, i => 0m);
        foreach (var p in previousDelivered)
            if (p.SalesOrderItemId is { } soiId && cumulative.ContainsKey(soiId))
                cumulative[soiId] += p.Total;
        foreach (var n in newDelivered)
            if (n.SalesOrderItemId is { } soiId && cumulative.ContainsKey(soiId))
                cumulative[soiId] += n.Total;

        var fullyDelivered = order.Items.Count > 0 &&
            order.Items.All(i => cumulative.TryGetValue(i.Id, out var qty) && qty >= i.Quantity);
        var anyDelivered = cumulative.Values.Any(q => q > 0);

        var newStatus = fullyDelivered ? "delivered" : anyDelivered ? "shipped" : order.Status;
        if (newStatus != order.Status)
            order.Update(order.CustomerId, order.CustomerName, order.Notes, order.ExpectedDate, newStatus);

        await db.SaveChangesAsync(ct);

        return Result.Success(new DeliveryChallanDto(
            challan.Id, challan.ChallanNumber, challan.SalesOrderId, order.OrderNumber,
            challan.CustomerId, order.Customer?.Name ?? order.CustomerName ?? "Walk-in Customer",
            challan.ChallanDate, challan.DriverName, challan.Notes, challan.Status,
            challan.Items.Select(i => new DeliveryChallanItemDto(
                i.Id, i.SalesOrderItemId, i.ProductId, i.Description,
                i.OrderedQuantity, i.DeliveredQuantity, i.UnitPrice, i.LineTotal)).ToList(),
            challan.CreatedAt, challan.UpdatedAt));
    }
}
