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
    string?  SpecialRequests,
    // PMS fields — null/zero on bookings taken before the PMS.
    Guid?     GuestId          = null,
    Guid?     RoomTypeId       = null,
    Guid?     RatePlanId       = null,
    string?   RatePlanName     = null,
    string?   MealPlan         = null,
    decimal   RoomCharge       = 0,
    decimal   ExtrasTotal      = 0,
    decimal   DiscountAmount   = 0,
    decimal   ServiceAmount    = 0,
    decimal   TaxAmount        = 0,
    decimal   FeeAmount        = 0,
    string?   CancelReason     = null,
    string?   Notes            = null,
    DateTime? ActualCheckInAt  = null,
    DateTime? ActualCheckOutAt = null,
    DateTime? CreatedAt        = null);

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

public sealed record BookingPaymentDto(
    Guid Id, Guid BookingId, decimal Amount, string Method, string PaidOn, string? Reference,
    decimal PaidTotal, decimal Balance);

public sealed record NightRateDto(string Date, decimal Rate, bool IsWeekend = false, string? Season = null);

public sealed record FolioChargeDto(
    Guid Id, string Date, string Category, string Description, decimal Quantity, decimal UnitPrice,
    decimal Amount, string? PostedBy, bool IsVoided, string? VoidReason);

/// <summary>Everything a guest owes and has paid for one stay — the bill.</summary>
public sealed record FolioDto(
    Guid    BookingId,
    string  BookingNumber,
    string  Status,
    string  GuestName,
    string  RoomNumber,
    string  CheckIn,
    string  CheckOut,
    IReadOnlyList<NightRateDto>      Nights,
    IReadOnlyList<FolioChargeDto>    Charges,
    IReadOnlyList<BookingPaymentDto> Payments,
    decimal RoomCharge,
    decimal ExtrasTotal,
    decimal DiscountAmount,
    string? DiscountReason,
    decimal ServiceChargePercent,
    decimal ServiceAmount,
    decimal TaxPercent,
    string  TaxLabel,
    decimal TaxAmount,
    decimal NightlyFee,
    string? NightlyFeeLabel,
    decimal FeeAmount,
    decimal Total,
    decimal Paid,
    decimal Balance);

public sealed record FrontDeskDto(
    string  Today,
    int     TotalRooms,
    int     OutOfOrder,
    int     OccupiedTonight,
    double  OccupancyPercent,
    decimal AverageDailyRate,
    decimal RevPar,
    decimal RoomRevenueTonight,
    int     DirtyRooms,
    int     ArrivalsPending,
    int     DeparturesPending,
    IReadOnlyList<BookingDto> Arrivals,
    IReadOnlyList<BookingDto> Departures,
    IReadOnlyList<BookingDto> InHouse,
    IReadOnlyList<BookingDto> NoShows);
