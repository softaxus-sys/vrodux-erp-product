using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Bookings.Dtos;
using Softaxis.Hospitality.Application.Bookings.Queries;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Bookings;

internal sealed class GetBookingsHandler(HospitalityDbContext db) : IQueryHandler<GetBookingsQuery, PagedResult<BookingDto>>
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for the whole booking history.</summary>
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<BookingDto>>> Handle(GetBookingsQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        var q = db.Bookings.AsNoTracking().Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        // The fields a front desk actually looks a booking up by.
        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.GuestName.Contains(query.Search)
                          || x.BookingNumber.Contains(query.Search)
                          || x.RoomNumber.Contains(query.Search)
                          || x.GuestEmail.Contains(query.Search)
                          || x.GuestPhone.Contains(query.Search));

        // Counted before paging so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .ThenBy(x => x.Id)              // stable: an import lands many rows on one timestamp
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Result.Success(PagedResult<BookingDto>.Create(
            items.Select(BookingMappings.ToDto).ToList(), total, page, pageSize));
    }
}
