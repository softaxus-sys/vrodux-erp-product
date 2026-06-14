namespace Softaxis.Finance.Application.Budgets.Dtos;

public sealed record BudgetLineDto(
    Guid Id, string Category, string? AccountName,
    decimal BudgetedAmount, decimal ActualAmount, decimal Variance);

public sealed record BudgetLineRequest(string Category, string? AccountName, decimal BudgetedAmount);

public sealed record BudgetListItemDto(
    Guid Id, string Name, string Period, string Status,
    decimal TotalBudgeted, decimal TotalActual, decimal Variance,
    int LineCount, DateTime CreatedAt, DateTime? UpdatedAt);

public sealed record BudgetDto(
    Guid Id, string Name, string Period, string Status, string? Notes,
    decimal TotalBudgeted, decimal TotalActual, decimal Variance,
    IReadOnlyList<BudgetLineDto> Lines, DateTime CreatedAt, DateTime? UpdatedAt);

public sealed record BudgetsSummaryDto(
    decimal TotalBudget, decimal TotalActual, decimal OverallVariance, decimal VariancePct,
    int DepsOverBudget, int DepsUnderBudget, decimal Utilisation);
