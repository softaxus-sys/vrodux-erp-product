using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Sales.Dtos;
using Softaxis.RealEstate.Application.Sales.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Sales;

internal sealed class GetSalesSummaryHandler(RealEstateDbContext db)
    : IQueryHandler<GetSalesSummaryQuery, SalesSummaryDto>
{
    public async Task<Result<SalesSummaryDto>> Handle(GetSalesSummaryQuery query, CancellationToken ct)
    {
        var visits = await db.SiteVisits.AsNoTracking().CountAsync(ct);
        var resv = await db.Reservations.AsNoTracking().Where(x => x.Status == "active").CountAsync(ct);
        var bookings = await db.Bookings.AsNoTracking()
            .Select(b => new { b.SalePrice, b.PaidAmount, b.Status }).ToListAsync(ct);

        return Result.Success(new SalesSummaryDto(
            visits,
            resv,
            bookings.Count,
            bookings.Sum(b => b.SalePrice),
            bookings.Sum(b => b.PaidAmount),
            bookings.Sum(b => Math.Max(0, b.SalePrice - b.PaidAmount)),
            bookings.Count(b => b.Status == "handover")));
    }
}
