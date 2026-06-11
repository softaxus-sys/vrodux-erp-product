using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Sales.Dtos;
using Softaxis.RealEstate.Application.Sales.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Sales;

internal sealed class GetBookingsHandler(RealEstateDbContext db)
    : IQueryHandler<GetBookingsQuery, IReadOnlyList<BookingDto>>
{
    public async Task<Result<IReadOnlyList<BookingDto>>> Handle(GetBookingsQuery query, CancellationToken ct)
    {
        var items = await db.Bookings.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<BookingDto>>(items.Select(SalesMappings.ToDto).ToList());
    }
}
