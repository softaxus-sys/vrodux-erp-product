using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Fitness.Application.Dashboard;

public sealed record NameCount(string Name, int Count);
public sealed record DayFigure(string Date, int Visits, decimal Revenue);

public sealed record ExpiringMemberDto(Guid MemberId, string MemberName, string MemberNumber, string? Phone,
    string PlanName, string EndDate, int DaysLeft);

public sealed record FitnessDashboardDto(
    int ActiveMembers, int TotalMembers, int NewThisMonth, int ExpiringSoon, int ExpiredLast30, int Frozen,
    int InGymNow, int VisitsToday, int ClassesToday, int BookingsToday, int PtSessionsToday,
    decimal RevenueToday, decimal RevenueThisMonth, decimal Outstanding, int OpenLeads, int LeadsFollowUpDue,
    int EquipmentNeedingService, decimal RetentionRate,
    IReadOnlyList<DayFigure> Last14Days, IReadOnlyList<NameCount> MembersByPlan,
    IReadOnlyList<NameCount> PeakHours, IReadOnlyList<ExpiringMemberDto> Expiring);

public sealed record GetFitnessDashboardQuery(Guid? BranchId, string? Today) : IQuery<FitnessDashboardDto>;
