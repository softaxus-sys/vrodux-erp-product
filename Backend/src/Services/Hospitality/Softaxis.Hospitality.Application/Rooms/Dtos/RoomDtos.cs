namespace Softaxis.Hospitality.Application.Rooms.Dtos;

public sealed record RoomDto(
    Guid     Id,
    string   RoomNumber,
    string   RoomType,
    int      Floor,
    int      Capacity,
    decimal  RatePerNight,
    string   Status,
    string   HousekeepingStatus,
    string?  CurrentGuestName,
    string?  CurrentBookingId,
    string?  View,
    bool     HasBalcony);

public sealed record RoomsSummaryDto(
    int    Total,
    int    Available,
    int    Occupied,
    int    Maintenance,
    int    Cleaning,
    double OccupancyRate,
    int    DirtyRooms,
    double AvgRate);
