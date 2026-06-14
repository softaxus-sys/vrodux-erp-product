namespace Softaxis.CRM.Application.Activities.Dtos;

public sealed record ActivityDto(
    Guid Id, string Type, string Subject, string? Description, string RelatedToType,
    Guid RelatedToId, string? RelatedToName, string? DueDate, bool Completed,
    DateTime? CompletedAt, string AssignedTo, DateTime CreatedAt, DateTime? UpdatedAt);

public sealed record ActivitiesSummaryDto(int OpenTasks, int Overdue, int DueToday, int Upcoming);
