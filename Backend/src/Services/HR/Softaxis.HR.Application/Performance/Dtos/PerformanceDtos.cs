namespace Softaxis.HR.Application.Performance.Dtos;

public sealed record GoalDto(
    Guid   Id,
    string Title,
    string Target,
    int    Progress,
    string Status,
    string DueDate);

public sealed record ReviewDto(
    Guid     Id,
    Guid     EmployeeId,
    string   EmployeeName,
    string?  Department,
    string?  Designation,
    string   ReviewPeriod,
    string   ReviewType,
    string   Status,
    int?     OverallRating,
    int?     TechnicalRating,
    int?     CommunicationRating,
    int?     TeamworkRating,
    int?     LeadershipRating,
    string   ReviewedBy,
    string   DueDate,
    string?  CompletedDate,
    string?  Strengths,
    string?  Improvements,
    IReadOnlyList<GoalDto> Goals);

public sealed record PerformanceSummaryDto(
    int    TotalReviews,
    int    Completed,
    int    Pending,
    int    InProgress,
    int    Overdue,
    double AvgRating);
