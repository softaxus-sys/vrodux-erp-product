using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Rooms.Dtos;
using Softaxis.Hospitality.Application.Rooms.Queries;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Rooms;

internal sealed class GetRoomsSummaryHandler(HospitalityDbContext db) : IQueryHandler<GetRoomsSummaryQuery, RoomsSummaryDto>
{
    public async Task<Result<RoomsSummaryDto>> Handle(GetRoomsSummaryQuery query, CancellationToken ct)
    {
        var all = await db.Rooms.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.HousekeepingStatus, x.RoomType, x.RatePerNight }).ToListAsync(ct);

        return Result.Success(new RoomsSummaryDto(
            all.Count,
            all.Count(x => x.Status == "available"),
            all.Count(x => x.Status == "occupied"),
            all.Count(x => x.Status == "maintenance"),
            all.Count(x => x.Status == "cleaning"),
            all.Count > 0 ? Math.Round((double)all.Count(x => x.Status == "occupied") / all.Count * 100, 1) : 0,
            all.Count(x => x.HousekeepingStatus == "dirty"),
            all.Count > 0 ? all.Average(x => (double)x.RatePerNight) : 0));
    }
}
