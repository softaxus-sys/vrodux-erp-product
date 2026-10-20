using Softaxis.Finance.Application.RecurringExpenses.Dtos;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Handlers.RecurringExpenses;

internal static class RecurringExpenseMappings
{
    public static RecurringExpenseDto ToDto(RecurringExpense r) => new(
        r.Id, r.TemplateName, r.Category, r.Amount, r.Vendor,
        r.PaymentMethod, r.Frequency, r.StartDate.ToString("yyyy-MM-dd"), r.EndDate?.ToString("yyyy-MM-dd"),
        r.NextRunDate.ToString("yyyy-MM-dd"), r.AutoPost, r.Reference, r.Notes, r.IsActive,
        r.LastGeneratedDate?.ToString("yyyy-MM-dd"), r.GeneratedCount,
        r.ExpenseAccountId, r.PaymentAccountId);

    public static DateTime? ParseNullableDate(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : (DateTime.TryParse(s, out var d) ? d : null);
}
