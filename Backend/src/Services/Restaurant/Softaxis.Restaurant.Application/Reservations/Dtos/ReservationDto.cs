namespace Softaxis.Restaurant.Application.Reservations.Dtos;

public sealed record ReservationDto(
    Guid Id,
    string ReservationNumber,
    Guid? BranchId,
    Guid? TableId,
    string? TableNumber,
    string GuestName,
    string GuestPhone,
    string? GuestEmail,
    int Covers,
    string ReservationDate,
    string ReservationTime,
    string Status,
    string? SpecialRequests,
    string? ArrivalWindowStart,
    string? ArrivalWindowEnd,
    DateTime? NoShowAt);

public sealed record ReservationRuleDto(
    Guid Id,
    Guid? BranchId,
    int SlotDurationMinutes,
    int MaxCoversPerSlot,
    int MaxAdvanceDays,
    int MinNoticeMinutes,
    int AutoNoShowMinutes,
    bool DepositRequired,
    decimal DepositAmount);

public sealed record ReservationsSummaryDto(
    int Total,
    int Confirmed,
    int Seated,
    int Completed,
    int Cancelled,
    int NoShow,
    int Today,
    int TodayCovers);

/// <summary>Small projection for the create-reservation response (mirrors the pre-migration shape).</summary>
public sealed record ReservationCreatedDto(Guid Id, string ReservationNumber, string Status);

/// <summary>Small projection for seat/cancel state-transition endpoints.</summary>
public sealed record ReservationStatusDto(Guid Id, string Status);
