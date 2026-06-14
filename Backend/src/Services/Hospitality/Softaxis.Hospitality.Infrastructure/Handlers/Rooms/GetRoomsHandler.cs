using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Rooms.Dtos;
using Softaxis.Hospitality.Application.Rooms.Queries;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Rooms;

internal sealed class GetRoomsHandler(HospitalityDbContext db) : IQueryHandler<GetRoomsQuery, IReadOnlyList<RoomDto>>
{
    public async Task<Result<IReadOnlyList<RoomDto>>> Handle(GetRoomsQuery query, CancellationToken ct)
    {
        var items = await db.Rooms.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.Floor).ThenBy(x => x.RoomNumber).ToListAsync(ct);

        return Result.Success<IReadOnlyList<RoomDto>>(items.Select(RoomMappings.ToDto).ToList());
    }
}
