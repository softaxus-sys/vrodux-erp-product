using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Sales.Application.DeliveryChallans.Dtos;
using Softaxis.Sales.Application.DeliveryChallans.Queries;
using Softaxis.Sales.Domain.Entities;
using Softaxis.Sales.Infrastructure.Persistence;

namespace Softaxis.Sales.Infrastructure.Handlers.DeliveryChallans;

internal sealed class GetDeliveryChallansHandler(SalesDbContext db)
    : IQueryHandler<GetDeliveryChallansQuery, IReadOnlyList<DeliveryChallanSummaryDto>>
{
    public async Task<Result<IReadOnlyList<DeliveryChallanSummaryDto>>> Handle(
        GetDeliveryChallansQuery query, CancellationToken ct)
    {
        IQueryable<DeliveryChallan> q = db.DeliveryChallans
            .AsNoTracking()
            .Include(x => x.SalesOrder)
            .Include(x => x.Customer)
            .Include(x => x.Items);

        if (query.SalesOrderId.HasValue)
            q = q.Where(x => x.SalesOrderId == query.SalesOrderId.Value);

        if (query.CustomerId.HasValue)
            q = q.Where(x => x.CustomerId == query.CustomerId.Value);

        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new DeliveryChallanSummaryDto(
                x.Id, x.ChallanNumber, x.SalesOrderId,
                x.SalesOrder != null ? x.SalesOrder.OrderNumber : "Unknown",
                x.CustomerId,
                x.Customer != null ? x.Customer.Name : (x.SalesOrder != null ? x.SalesOrder.CustomerName : null) ?? "Walk-in Customer",
                x.ChallanDate, x.DriverName, x.Status, x.Items.Count, x.CreatedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<DeliveryChallanSummaryDto>>(items);
    }
}
