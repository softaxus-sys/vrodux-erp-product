using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Bookings.Dtos;
using Softaxis.Hospitality.Application.Bookings.Queries;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Bookings;

internal sealed class GetBookingsHandler(HospitalityDbContext db) : IQueryHandler<GetBookingsQuery, IReadOnlyList<BookingDto>>
{
    public async Task<Result<IReadOnlyList<BookingDto>>> Handle(GetBookingsQuery query, CancellationToken ct)
    {
        var items = await db.Bookings.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.CreatedAt).ToListAsync(ct);

        return Result.Success<IReadOnlyList<BookingDto>>(items.Select(BookingMappings.ToDto).ToList());
    }
}
