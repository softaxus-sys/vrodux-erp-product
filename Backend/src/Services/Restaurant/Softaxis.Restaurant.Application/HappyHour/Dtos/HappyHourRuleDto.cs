namespace Softaxis.Restaurant.Application.HappyHour.Dtos;

public sealed record HappyHourRuleDto(
    Guid Id, Guid? BranchId, string Name, int DaysOfWeekMask, string StartTime, string EndTime,
    string DiscountType, decimal DiscountValue, Guid? CategoryId, bool IsActive);
