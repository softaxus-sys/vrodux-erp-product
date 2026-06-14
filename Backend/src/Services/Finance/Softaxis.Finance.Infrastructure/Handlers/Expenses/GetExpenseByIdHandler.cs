using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Expenses.Dtos;
using Softaxis.Finance.Application.Expenses.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Expenses;

internal sealed class GetExpenseByIdHandler(FinanceDbContext db) : IQueryHandler<GetExpenseByIdQuery, ExpenseDto>
{
    public async Task<Result<ExpenseDto>> Handle(GetExpenseByIdQuery query, CancellationToken ct)
    {
        var expense = await db.Expenses.AsNoTracking()
            .Where(x => x.Id == query.Id)
            .Select(x => new ExpenseDto(
                x.Id, x.ExpenseNumber, x.Title, x.Category, x.Amount, x.ExpenseDate,
                x.PaidBy, x.PaymentMethod, x.Reference, x.Notes, x.Status,
                x.ApprovedById, x.ApprovedAt, x.CreatedAt, x.UpdatedAt,
                x.ReceiptData != null, x.ReceiptFileName))
            .FirstOrDefaultAsync(ct);

        if (expense is null)
            return Result.Failure<ExpenseDto>(Error.NotFoundById("Expense", query.Id));

        return Result.Success(expense);
    }
}
