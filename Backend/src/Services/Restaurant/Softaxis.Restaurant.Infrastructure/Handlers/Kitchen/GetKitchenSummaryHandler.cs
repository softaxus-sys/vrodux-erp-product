using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Kitchen.Dtos;
using Softaxis.Restaurant.Application.Kitchen.Queries;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Kitchen;

internal sealed class GetKitchenSummaryHandler(RestaurantDbContext db)
    : IQueryHandler<GetKitchenSummaryQuery, KitchenSummaryDto>
{
    public async Task<Result<KitchenSummaryDto>> Handle(GetKitchenSummaryQuery query, CancellationToken ct)
    {
        var orders = await db.Orders.AsNoTracking()
            .Where(x => !x.IsDeleted && (x.Status == "sent" || x.Status == "ready"))
            .Select(x => new { x.Status }).ToListAsync(ct);
        var items = await db.OrderItems.AsNoTracking()
            .Where(x => !x.IsDeleted && (x.Status == "pending" || x.Status == "preparing"))
            .Select(x => new { x.Status }).ToListAsync(ct);

        var dto = new KitchenSummaryDto(
            ActiveOrders: orders.Count,
            SentToKitchen: orders.Count(x => x.Status == "sent"),
            Ready: orders.Count(x => x.Status == "ready"),
            PendingItems: items.Count(x => x.Status == "pending"),
            PreparingItems: items.Count(x => x.Status == "preparing"));

        return Result.Success(dto);
    }
}
