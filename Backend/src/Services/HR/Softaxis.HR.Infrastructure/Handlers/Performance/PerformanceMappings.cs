using Softaxis.HR.Application.Performance.Dtos;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Handlers.Performance;

internal static class PerformanceMappings
{
    public static bool IsOverdue(PerformanceReview r) =>
        r.Status != "completed" && string.CompareOrdinal(r.DueDate, DateTime.UtcNow.ToString("yyyy-MM-dd")) < 0;

    public static ReviewDto ToDto(PerformanceReview r) => new(
        r.Id, r.EmployeeId, r.EmployeeName, r.Department, r.Designation,
        r.ReviewPeriod, r.ReviewType, IsOverdue(r) ? "overdue" : r.Status,
        r.OverallRating, r.TechnicalRating, r.CommunicationRating, r.TeamworkRating, r.LeadershipRating,
        r.ReviewedBy, r.DueDate, r.CompletedDate, r.Strengths, r.Improvements,
        r.Goals.Select(g => new GoalDto(g.Id, g.Title, g.Target, g.Progress, g.Status, g.DueDate)).ToList());
}
