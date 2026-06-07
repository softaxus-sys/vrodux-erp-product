using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/budgets")]
[Authorize]
public sealed class BudgetsController(FinanceDbContext db) : ControllerBase
{
    public record BudgetLineDto(
        Guid    Id,
        string  Category,
        string? AccountName,
        decimal BudgetedAmount,
        decimal ActualAmount,
        decimal Variance);

    public record BudgetSummaryDto(
        Guid      Id,
        string    Name,
        string    Period,
        string    Status,
        decimal   TotalBudgeted,
        decimal   TotalActual,
        decimal   Variance,
        int       LineCount,
        DateTime  CreatedAt,
        DateTime? UpdatedAt);

    public record BudgetDto(
        Guid      Id,
        string    Name,
        string    Period,
        string    Status,
        string?   Notes,
        decimal   TotalBudgeted,
        decimal   TotalActual,
        decimal   Variance,
        IReadOnlyList<BudgetLineDto> Lines,
        DateTime  CreatedAt,
        DateTime? UpdatedAt);

    public record BudgetLineRequest(
        string  Category,
        string? AccountName,
        decimal BudgetedAmount);

    public record CreateBudgetRequest(
        string  Name,
        string  Period,
        string? Notes,
        IReadOnlyList<BudgetLineRequest> Lines);

    public record UpdateBudgetRequest(
        string  Name,
        string  Period,
        string  Status,
        string? Notes,
        IReadOnlyList<BudgetLineRequest> Lines);

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var budgets = await db.Budgets.AsNoTracking()
            .Where(x => !x.IsDeleted)
            .Include(x => x.Lines)
            .ToListAsync(ct);

        if (!budgets.Any())
            return Ok(new { totalBudget = 0m, totalActual = 0m, overallVariance = 0m, variancePct = 0m,
                depsOverBudget = 0, depsUnderBudget = 0, utilisation = 0m });

        var totalBudget  = budgets.Sum(b => b.TotalBudgeted);
        var totalActual  = budgets.Sum(b => b.TotalActual);
        var variance     = totalBudget - totalActual;
        var variancePct  = totalBudget > 0 ? variance / totalBudget * 100 : 0;
        var utilisation  = totalBudget > 0 ? totalActual / totalBudget * 100 : 0;

        return Ok(new
        {
            totalBudget,
            totalActual,
            overallVariance = variance,
            variancePct     = Math.Round(variancePct, 1),
            depsOverBudget  = budgets.Count(b => b.TotalActual > b.TotalBudgeted),
            depsUnderBudget = budgets.Count(b => b.TotalActual <= b.TotalBudgeted),
            utilisation     = Math.Round(utilisation, 1),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? period = null,
        [FromQuery] string? status = null,
        CancellationToken ct = default)
    {
        IQueryable<Budget> query = db.Budgets.AsNoTracking().Include(x => x.Lines);

        if (!string.IsNullOrWhiteSpace(period))
            query = query.Where(x => x.Period == period);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status);

        var items = await query
            .OrderByDescending(x => x.Period)
            .Select(x => new BudgetSummaryDto(
                x.Id, x.Name, x.Period, x.Status,
                x.Lines.Sum(l => l.BudgetedAmount),
                x.Lines.Sum(l => l.ActualAmount),
                x.Lines.Sum(l => l.BudgetedAmount) - x.Lines.Sum(l => l.ActualAmount),
                x.Lines.Count,
                x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var budget = await db.Budgets.AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return budget is null ? NotFound() : Ok(ToDto(budget));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateBudgetRequest req, CancellationToken ct)
    {
        var budget = new Budget(req.Name, req.Period, req.Notes);

        foreach (var l in req.Lines)
            budget.Lines.Add(new BudgetLine(budget.Id, l.Category, l.AccountName, l.BudgetedAmount));

        db.Budgets.Add(budget);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = budget.Id }, ToDto(budget));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBudgetRequest req, CancellationToken ct)
    {
        var budget = await db.Budgets.Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (budget is null) return NotFound();

        budget.Update(req.Name, req.Period, req.Status, req.Notes);

        db.BudgetLines.RemoveRange(budget.Lines);
        budget.Lines.Clear();
        foreach (var l in req.Lines)
            budget.Lines.Add(new BudgetLine(budget.Id, l.Category, l.AccountName, l.BudgetedAmount));

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var budget = await db.Budgets.FindAsync([id], ct);
        if (budget is null) return NotFound();
        budget.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static BudgetDto ToDto(Budget b) => new(
        b.Id, b.Name, b.Period, b.Status, b.Notes,
        b.TotalBudgeted, b.TotalActual, b.Variance,
        b.Lines.Select(l => new BudgetLineDto(
            l.Id, l.Category, l.AccountName,
            l.BudgetedAmount, l.ActualAmount, l.Variance)).ToList(),
        b.CreatedAt, b.UpdatedAt);
}
