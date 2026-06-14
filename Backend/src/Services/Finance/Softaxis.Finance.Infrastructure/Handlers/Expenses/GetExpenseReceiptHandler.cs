using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Expenses.Dtos;
using Softaxis.Finance.Application.Expenses.Queries;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Expenses;

internal sealed class GetExpenseReceiptHandler(FinanceDbContext db) : IQueryHandler<GetExpenseReceiptQuery, ExpenseReceiptDto>
{
    public async Task<Result<ExpenseReceiptDto>> Handle(GetExpenseReceiptQuery query, CancellationToken ct)
    {
        var receipt = await db.Expenses.AsNoTracking()
            .Where(x => x.Id == query.Id)
            .Select(x => new { x.ReceiptData, x.ReceiptFileName, x.ReceiptContentType })
            .FirstOrDefaultAsync(ct);

        if (receipt is null)
            return Result.Failure<ExpenseReceiptDto>(Error.NotFoundById("Expense", query.Id));

        if (receipt.ReceiptData is null || receipt.ReceiptData.Length == 0)
            return Result.Failure<ExpenseReceiptDto>(Error.Custom("Expense.NoReceipt", "This expense has no receipt attached."));

        return Result.Success(new ExpenseReceiptDto(
            receipt.ReceiptData,
            receipt.ReceiptFileName ?? "receipt",
            receipt.ReceiptContentType ?? "application/octet-stream"));
    }
}
