using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/expenses")]
[Authorize]
public sealed class ExpensesController(FinanceDbContext db) : ControllerBase
{
    public record ExpenseDto(
        Guid      Id,
        string    ExpenseNumber,
        string    Title,
        string    Category,
        decimal   Amount,
        string    ExpenseDate,
        string?   PaidBy,
        string?   PaymentMethod,
        string?   Reference,
        string?   Notes,
        string    Status,
        Guid?     ApprovedById,
        DateTime? ApprovedAt,
        DateTime  CreatedAt,
        DateTime? UpdatedAt);

    public record CreateExpenseRequest(
        string  Title,
        string  Category,
        decimal Amount,
        string  ExpenseDate,
        string? PaidBy,
        string? PaymentMethod,
        string? Reference,
        string? Notes);

    public record UpdateExpenseRequest(
        string  Title,
        string  Category,
        decimal Amount,
        string  ExpenseDate,
        string? PaidBy,
        string? PaymentMethod,
        string? Reference,
        string? Notes);

    public record ApproveRequest(Guid ApproverId);

    public record PagedResult<T>(
        IReadOnlyList<T> Items, int Page, int PageSize,
        int TotalCount, int TotalPages, bool HasNext, bool HasPrev);

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.Expenses.AsNoTracking()
            .Where(x => !x.IsDeleted)
            .Select(x => new { x.Status, x.Amount })
            .ToListAsync(ct);

        return Ok(new
        {
            total            = all.Count,
            draft            = all.Count(x => x.Status == "draft"),
            pending          = all.Count(x => x.Status == "pending"),
            approved         = all.Count(x => x.Status == "approved"),
            rejected         = all.Count(x => x.Status == "rejected"),
            paid             = all.Count(x => x.Status == "paid"),
            totalAmount      = all.Sum(x => x.Amount),
            totalPaid        = all.Where(x => x.Status == "paid").Sum(x => x.Amount),
            pendingApproval  = all.Count(x => x.Status == "pending"),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page      = 1,
        [FromQuery] int     pageSize  = 20,
        [FromQuery] string? search    = null,
        [FromQuery] string? status    = null,
        [FromQuery] string? category  = null,
        [FromQuery] string? dateFrom  = null,
        [FromQuery] string? dateTo    = null,
        CancellationToken ct = default)
    {
        IQueryable<Expense> query = db.Expenses.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x => x.Title.Contains(search) || x.ExpenseNumber.Contains(search));

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(x => x.Category == category);

        if (!string.IsNullOrWhiteSpace(dateFrom))
            query = query.Where(x => string.Compare(x.ExpenseDate, dateFrom) >= 0);

        if (!string.IsNullOrWhiteSpace(dateTo))
            query = query.Where(x => string.Compare(x.ExpenseDate, dateTo) <= 0);

        var total      = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / pageSize);

        var items = await query
            .OrderByDescending(x => x.ExpenseDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => ToDto(x))
            .ToListAsync(ct);

        return Ok(new PagedResult<ExpenseDto>(items, page, pageSize, total, totalPages,
            page < totalPages, page > 1));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var exp = await db.Expenses.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => ToDto(x))
            .FirstOrDefaultAsync(ct);
        return exp is null ? NotFound() : Ok(exp);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateExpenseRequest req, CancellationToken ct)
    {
        var expense = new Expense(req.Title, req.Category, req.Amount, req.ExpenseDate,
            req.PaidBy, req.PaymentMethod, req.Reference, req.Notes);
        db.Expenses.Add(expense);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = expense.Id }, ToDto(expense));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateExpenseRequest req, CancellationToken ct)
    {
        var expense = await db.Expenses.FindAsync([id], ct);
        if (expense is null) return NotFound();
        if (expense.Status != "pending")
            return BadRequest(new { error = "Only pending expenses can be edited." });

        expense.Update(req.Title, req.Category, req.Amount, req.ExpenseDate,
            req.PaidBy, req.PaymentMethod, req.Reference, req.Notes);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveRequest req, CancellationToken ct)
    {
        var expense = await db.Expenses.FindAsync([id], ct);
        if (expense is null) return NotFound();
        if (expense.Status != "pending")
            return BadRequest(new { error = "Only pending expenses can be approved." });
        expense.Approve(req.ApproverId);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ApproveRequest req, CancellationToken ct)
    {
        var expense = await db.Expenses.FindAsync([id], ct);
        if (expense is null) return NotFound();
        if (expense.Status != "pending")
            return BadRequest(new { error = "Only pending expenses can be rejected." });
        expense.Reject(req.ApproverId);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/pay")]
    public async Task<IActionResult> MarkPaid(Guid id, CancellationToken ct)
    {
        var expense = await db.Expenses.FindAsync([id], ct);
        if (expense is null) return NotFound();
        if (expense.Status != "approved")
            return BadRequest(new { error = "Only approved expenses can be marked as paid." });
        expense.MarkPaid();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var expense = await db.Expenses.FindAsync([id], ct);
        if (expense is null) return NotFound();
        expense.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static ExpenseDto ToDto(Expense x) => new(
        x.Id, x.ExpenseNumber, x.Title, x.Category, x.Amount, x.ExpenseDate,
        x.PaidBy, x.PaymentMethod, x.Reference, x.Notes, x.Status,
        x.ApprovedById, x.ApprovedAt, x.CreatedAt, x.UpdatedAt);
}
