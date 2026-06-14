using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Hospitality.Application.Rooms.Dtos;

namespace Softaxis.Hospitality.Application.Rooms.Queries;

public sealed record GetRoomsSummaryQuery : IQuery<RoomsSummaryDto>;

public sealed record GetRoomsQuery : IQuery<IReadOnlyList<RoomDto>>;
