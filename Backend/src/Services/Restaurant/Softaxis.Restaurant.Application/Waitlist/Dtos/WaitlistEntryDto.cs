namespace Softaxis.Restaurant.Application.Waitlist.Dtos;

public sealed record WaitlistEntryDto(
    Guid Id,
    Guid? BranchId,
    string GuestName,
    string GuestPhone,
    int PartySize,
    int QuotedWaitMinutes,
    string Status,
    DateTime ArrivedAt,
    DateTime? SeatedAt,
    Guid? TableId,
    string? Notes,
    int WaitedMinutes);

public sealed record WaitlistSummaryDto(
    int Total,
    int Waiting,
    int Seated,
    int NoShow,
    int Cancelled,
    double AverageQuotedWaitMinutes);
