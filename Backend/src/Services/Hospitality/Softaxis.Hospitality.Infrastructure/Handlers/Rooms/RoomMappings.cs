using Softaxis.Hospitality.Application.Rooms.Dtos;
using Softaxis.Hospitality.Domain.Entities;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Rooms;

internal static class RoomMappings
{
    public static RoomDto ToDto(Room r) => new(
        r.Id, r.RoomNumber, r.RoomType, r.Floor, r.Capacity, r.RatePerNight,
        r.Status, r.HousekeepingStatus, r.CurrentGuestName, r.CurrentBookingId,
        r.View, r.HasBalcony);
}
