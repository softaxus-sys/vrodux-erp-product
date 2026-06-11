using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.Expenses.Dtos;
using Softaxis.Finance.Application.Expenses.Queries;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.Expenses;

internal sealed class GetExpensesHandler(FinanceDbContext db) : IQueryHandler<GetExpensesQuery, PagedResult<ExpenseDto>>
{
    public async Task<Result<PagedResult<ExpenseDto>>> Handle(GetExpensesQuery query, CancellationToken ct)
    {
        IQueryable<Expense> q = db.Expenses.AsNoTracking().Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.Title.Contains(query.Search) || x.ExpenseNumber.Contains(query.Search));

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        if (!string.IsNullOrWhiteSpace(query.Category))
            q = q.Where(x => x.Category == query.Category);

        if (!string.IsNullOrWhiteSpace(query.DateFrom))
            q = q.Where(x => string.Compare(x.ExpenseDate, query.DateFrom) >= 0);

        if (!string.IsNullOrWhiteSpace(query.DateTo))
            q = q.Where(x => string.Compare(x.ExpenseDate, query.DateTo) <= 0);

        var total      = await q.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / query.PageSize);

        var items = await q
            .OrderByDescending(x => x.ExpenseDate)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(x => ExpenseMappings.ToDto(x))
            .ToListAsync(ct);

        return Result.Success(new PagedResult<ExpenseDto>(
            items, query.Page, query.PageSize, total, totalPages,
            query.Page < totalPages, query.Page > 1));
    }
}
