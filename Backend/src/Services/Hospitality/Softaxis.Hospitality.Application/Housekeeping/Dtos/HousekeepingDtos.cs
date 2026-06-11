namespace Softaxis.Hospitality.Application.Housekeeping.Dtos;

public sealed record HousekeepingTaskDto(
    Guid Id, Guid RoomId, string RoomNumber, string TaskType, string Priority, string Status,
    string? AssignedTo, DateTime? StartedAt, DateTime? CompletedAt, string? Notes);

public sealed record HousekeepingSummaryDto(
    int Total, int Pending, int InProgress, int Completed, int Verified, int Urgent, int High);

public sealed record HousekeepingTaskStatusDto(Guid Id, string Status);
