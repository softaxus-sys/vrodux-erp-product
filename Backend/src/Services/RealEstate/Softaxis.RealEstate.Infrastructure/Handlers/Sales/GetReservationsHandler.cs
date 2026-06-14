using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Sales.Dtos;
using Softaxis.RealEstate.Application.Sales.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Sales;

internal sealed class GetReservationsHandler(RealEstateDbContext db)
    : IQueryHandler<GetReservationsQuery, IReadOnlyList<ReservationDto>>
{
    public async Task<Result<IReadOnlyList<ReservationDto>>> Handle(GetReservationsQuery query, CancellationToken ct)
    {
        var items = await db.Reservations.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<ReservationDto>>(items.Select(SalesMappings.ToDto).ToList());
    }
}
