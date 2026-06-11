using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Bookings.Dtos;
using Softaxis.Hospitality.Application.Bookings.Queries;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Bookings;

internal sealed class GetBookingsSummaryHandler(HospitalityDbContext db) : IQueryHandler<GetBookingsSummaryQuery, BookingsSummaryDto>
{
    public async Task<Result<BookingsSummaryDto>> Handle(GetBookingsSummaryQuery query, CancellationToken ct)
    {
        var all = await db.Bookings.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.TotalAmount, x.PaidAmount, x.Source }).ToListAsync(ct);

        return Result.Success(new BookingsSummaryDto(
            all.Count,
            all.Count(x => x.Status == "confirmed"),
            all.Count(x => x.Status == "checked_in"),
            all.Count(x => x.Status == "checked_out"),
            all.Count(x => x.Status == "cancelled"),
            all.Where(x => x.Status != "cancelled").Sum(x => x.TotalAmount),
            all.Sum(x => x.PaidAmount),
            all.Where(x => x.Status != "cancelled").Sum(x => x.TotalAmount - x.PaidAmount)));
    }
}
