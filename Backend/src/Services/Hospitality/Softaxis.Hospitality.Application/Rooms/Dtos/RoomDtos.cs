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
    bool     HasBalcony,
    Guid?    RoomTypeId = null,
    string?  Notes      = null);

public sealed record RoomsSummaryDto(
    int    Total,
    int    Available,
    int    Occupied,
    int    Maintenance,
    int    Cleaning,
    double OccupancyRate,
    int    DirtyRooms,
    double AvgRate);

public sealed record RoomTypeDto(
    Guid    Id,
    string  Code,
    string  Name,
    string? Description,
    string? Amenities,
    decimal BaseRate,
    int     MaxAdults,
    int     MaxChildren,
    bool    IsActive,
    int     RoomCount);

public sealed record RoomBlockDto(
    Guid Id, Guid RoomId, string RoomNumber, string FromDate, string ToDate, string Reason);

public sealed record RatePlanDto(
    Guid    Id,
    string  Code,
    string  Name,
    string  MealPlan,
    bool    IsRefundable,
    string? Description,
    bool    IsDefault,
    bool    IsActive,
    IReadOnlyList<SeasonalRateDto> Seasons);

public sealed record SeasonalRateDto(
    Guid     Id,
    Guid     RatePlanId,
    Guid     RoomTypeId,
    string   RoomTypeName,
    string   Label,
    string   FromDate,
    string   ToDate,
    decimal  WeekdayRate,
    decimal? WeekendRate,
    int      MinNights);

public sealed record HotelSettingsDto(
    string? PropertyName,
    string  WeekendDays,
    string  CheckInTime,
    string  CheckOutTime,
    decimal TaxPercent,
    string  TaxLabel,
    decimal ServiceChargePercent,
    decimal NightlyFee,
    string? NightlyFeeLabel);

// ── Availability ──────────────────────────────────────────────────────────────

public sealed record AvailableRoomDto(Guid Id, string RoomNumber, int Floor, string? View, bool HasBalcony, string HousekeepingStatus);

public sealed record StayQuoteDto(
    IReadOnlyList<Bookings.Dtos.NightRateDto> Nights,
    decimal RoomCharge,
    decimal ServiceAmount,
    decimal TaxAmount,
    decimal FeeAmount,
    decimal Total,
    int     MinNightsRequired);

public sealed record RoomTypeAvailabilityDto(
    Guid    RoomTypeId,
    string  Code,
    string  Name,
    int     MaxAdults,
    int     MaxChildren,
    int     TotalRooms,
    int     AvailableCount,
    bool    FitsParty,
    IReadOnlyList<AvailableRoomDto> Rooms,
    StayQuoteDto Quote);

public sealed record AvailabilityResultDto(
    string CheckIn,
    string CheckOut,
    int    Nights,
    Guid?  RatePlanId,
    string? RatePlanName,
    IReadOnlyList<RoomTypeAvailabilityDto> RoomTypes);

public sealed record TapeRoomDto(
    Guid Id, string RoomNumber, string RoomType, Guid? RoomTypeId, int Floor, string Status, string HousekeepingStatus);

public sealed record TapeBookingDto(
    Guid Id, Guid RoomId, string BookingNumber, string GuestName, string CheckIn, string CheckOut,
    string Status, decimal Balance, int Adults, int Children, string Source);

public sealed record TapeChartDto(
    string From,
    int    Days,
    IReadOnlyList<TapeRoomDto>    Rooms,
    IReadOnlyList<TapeBookingDto> Bookings,
    IReadOnlyList<RoomBlockDto>   Blocks);
