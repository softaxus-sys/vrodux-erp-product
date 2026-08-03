using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Menu.Dtos;
using Softaxis.Restaurant.Application.Menu.Queries;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Menu;

internal sealed class GetMenuSummaryHandler(RestaurantDbContext db)
    : IQueryHandler<GetMenuSummaryQuery, MenuSummaryDto>
{
    public async Task<Result<MenuSummaryDto>> Handle(GetMenuSummaryQuery query, CancellationToken ct)
    {
        var categories = await db.MenuCategories.AsNoTracking().Where(x => !x.IsDeleted).CountAsync(ct);
        var items = await db.MenuItems.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.IsAvailable, x.Price }).ToListAsync(ct);

        var dto = new MenuSummaryDto(
            TotalCategories: categories,
            TotalItems: items.Count,
            AvailableItems: items.Count(x => x.IsAvailable),
            UnavailableItems: items.Count(x => !x.IsAvailable),
            AvgPrice: items.Count > 0 ? Math.Round(items.Average(x => (double)x.Price), 2) : 0,
            MinPrice: items.Count > 0 ? items.Min(x => x.Price) : 0,
            MaxPrice: items.Count > 0 ? items.Max(x => x.Price) : 0);

        return Result.Success(dto);
    }
}
