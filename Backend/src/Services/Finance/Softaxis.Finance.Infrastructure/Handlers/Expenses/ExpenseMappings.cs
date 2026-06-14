using Softaxis.Finance.Application.Expenses.Dtos;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Handlers.Expenses;

internal static class ExpenseMappings
{
    public static ExpenseDto ToDto(Expense x) => new(
        x.Id, x.ExpenseNumber, x.Title, x.Category, x.Amount, x.ExpenseDate,
        x.PaidBy, x.PaymentMethod, x.Reference, x.Notes, x.Status,
        x.ApprovedById, x.ApprovedAt, x.CreatedAt, x.UpdatedAt,
        x.HasReceipt, x.ReceiptFileName);
}
