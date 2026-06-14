namespace Softaxis.Hospitality.Application.Bookings.Dtos;

public sealed record BookingDto(
    Guid     Id,
    string   BookingNumber,
    Guid     RoomId,
    string   RoomNumber,
    string   RoomType,
    string   GuestName,
    string   GuestEmail,
    string   GuestPhone,
    string   GuestNationality,
    string   CheckIn,
    string   CheckOut,
    int      Nights,
    int      Adults,
    int      Children,
    decimal  RatePerNight,
    decimal  TotalAmount,
    decimal  PaidAmount,
    decimal  Balance,
    string   Status,
    string   Source,
    string?  SpecialRequests);

public sealed record BookingsSummaryDto(
    int     Total,
    int     Confirmed,
    int     CheckedIn,
    int     CheckedOut,
    int     Cancelled,
    decimal TotalRevenue,
    decimal TotalCollected,
    decimal Outstanding);

public sealed record CreateBookingResultDto(Guid Id, string BookingNumber, decimal TotalAmount);

public sealed record BookingStatusDto(Guid Id, string Status);
