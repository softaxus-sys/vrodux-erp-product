using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Hospitality.Application.Rooms.Dtos;

namespace Softaxis.Hospitality.Application.Rooms.Queries;

public sealed record GetRoomsSummaryQuery : IQuery<RoomsSummaryDto>;

public sealed record GetRoomsQuery : IQuery<IReadOnlyList<RoomDto>>;

public sealed record GetRoomTypesQuery(bool IncludeInactive = false) : IQuery<IReadOnlyList<RoomTypeDto>>;

public sealed record GetRatePlansQuery(bool IncludeInactive = false) : IQuery<IReadOnlyList<RatePlanDto>>;

public sealed record GetHotelSettingsQuery : IQuery<HotelSettingsDto>;

public sealed record GetRoomBlocksQuery(string? From = null, string? To = null) : IQuery<IReadOnlyList<RoomBlockDto>>;

/// <summary>Which rooms of each type are free for every night of the stay, and what the stay costs.</summary>
public sealed record SearchAvailabilityQuery(
    string CheckIn, string CheckOut, int Adults = 1, int Children = 0,
    Guid? RoomTypeId = null, Guid? RatePlanId = null, Guid? ExcludeBookingId = null) : IQuery<AvailabilityResultDto>;

/// <summary>Rooms down the side, days across the top: the front-desk planning grid.</summary>
public sealed record GetTapeChartQuery(string? From = null, int Days = 14) : IQuery<TapeChartDto>;
