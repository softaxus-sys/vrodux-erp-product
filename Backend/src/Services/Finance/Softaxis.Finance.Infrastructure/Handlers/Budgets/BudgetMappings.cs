using Softaxis.Finance.Application.Budgets.Dtos;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Handlers.Budgets;

internal static class BudgetMappings
{
    public static BudgetDto ToDto(Budget b) => new(
        b.Id, b.Name, b.Period, b.Status, b.Notes,
        b.TotalBudgeted, b.TotalActual, b.Variance,
        b.Lines.Select(ToDto).ToList(),
        b.CreatedAt, b.UpdatedAt);

    public static BudgetLineDto ToDto(BudgetLine l) => new(
        l.Id, l.Category, l.AccountName, l.BudgetedAmount, l.ActualAmount, l.Variance);
}
