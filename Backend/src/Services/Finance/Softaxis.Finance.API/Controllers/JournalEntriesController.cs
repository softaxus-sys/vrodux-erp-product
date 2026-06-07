using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/journal-entries")]
[Authorize]
public sealed class JournalEntriesController(FinanceDbContext db) : ControllerBase
{
    public record JournalLineDto(
        Guid    Id,
        Guid    AccountId,
        string  AccountName,
        decimal DebitAmount,
        decimal CreditAmount,
        string? Description);

    public record JournalEntrySummaryDto(
        Guid      Id,
        string    EntryNumber,
        string    Date,
        string    Description,
        string?   Reference,
        string    Status,
        decimal   TotalDebit,
        decimal   TotalCredit,
        int       LineCount,
        DateTime  CreatedAt,
        DateTime? UpdatedAt);

    public record JournalEntryDto(
        Guid      Id,
        string    EntryNumber,
        string    Date,
        string    Description,
        string?   Reference,
        string    Status,
        string?   Notes,
        decimal   TotalDebit,
        decimal   TotalCredit,
        bool      IsBalanced,
        IReadOnlyList<JournalLineDto> Lines,
        DateTime  CreatedAt,
        DateTime? UpdatedAt);

    public record LineRequest(
        Guid    AccountId,
        string  AccountName,
        decimal DebitAmount,
        decimal CreditAmount,
        string? Description);

    public record CreateJournalEntryRequest(
        string  Date,
        string  Description,
        string? Reference,
        string? Notes,
        IReadOnlyList<LineRequest> Lines);

    public record PagedResult<T>(
        IReadOnlyList<T> Items, int Page, int PageSize,
        int TotalCount, int TotalPages, bool HasNext, bool HasPrev);

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20,
        [FromQuery] string? search   = null,
        [FromQuery] string? status   = null,
        [FromQuery] string? dateFrom = null,
        [FromQuery] string? dateTo   = null,
        CancellationToken ct = default)
    {
        IQueryable<JournalEntry> query = db.JournalEntries
            .AsNoTracking()
            .Include(x => x.Lines);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x => x.EntryNumber.Contains(search) ||
                                     x.Description.Contains(search) ||
                                     (x.Reference != null && x.Reference.Contains(search)));

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status);

        if (!string.IsNullOrWhiteSpace(dateFrom))
            query = query.Where(x => string.Compare(x.Date, dateFrom) >= 0);

        if (!string.IsNullOrWhiteSpace(dateTo))
            query = query.Where(x => string.Compare(x.Date, dateTo) <= 0);

        var total      = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / pageSize);

        var items = await query
            .OrderByDescending(x => x.Date)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new JournalEntrySummaryDto(
                x.Id, x.EntryNumber, x.Date, x.Description, x.Reference, x.Status,
                x.Lines.Sum(l => l.DebitAmount),
                x.Lines.Sum(l => l.CreditAmount),
                x.Lines.Count,
                x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Ok(new PagedResult<JournalEntrySummaryDto>(items, page, pageSize, total, totalPages,
            page < totalPages, page > 1));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var entry = await db.JournalEntries
            .AsNoTracking()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return entry is null ? NotFound() : Ok(ToDto(entry));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateJournalEntryRequest req, CancellationToken ct)
    {
        var entry = new JournalEntry(req.Date, req.Description, req.Reference, req.Notes);

        foreach (var l in req.Lines)
            entry.Lines.Add(new JournalEntryLine(
                entry.Id, l.AccountId, l.AccountName,
                l.DebitAmount, l.CreditAmount, l.Description));

        db.JournalEntries.Add(entry);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = entry.Id }, ToDto(entry));
    }

    [HttpPost("{id:guid}/post")]
    public async Task<IActionResult> Post(Guid id, CancellationToken ct)
    {
        var entry = await db.JournalEntries
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (entry is null) return NotFound();
        if (entry.Status != "draft")
            return BadRequest(new { error = "Only draft entries can be posted." });

        if (!entry.IsBalanced)
            return BadRequest(new { error = $"Entry is not balanced. Debit: {entry.TotalDebit}, Credit: {entry.TotalCredit}" });

        entry.Post();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/void")]
    public async Task<IActionResult> Void(Guid id, CancellationToken ct)
    {
        var entry = await db.JournalEntries.FindAsync([id], ct);
        if (entry is null) return NotFound();
        if (entry.Status == "voided")
            return BadRequest(new { error = "Entry is already voided." });
        entry.Void();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var entry = await db.JournalEntries.FindAsync([id], ct);
        if (entry is null) return NotFound();
        if (entry.Status == "posted")
            return BadRequest(new { error = "Posted journal entries cannot be deleted. Void instead." });
        entry.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static JournalEntryDto ToDto(JournalEntry e) => new(
        e.Id, e.EntryNumber, e.Date, e.Description, e.Reference, e.Status, e.Notes,
        e.TotalDebit, e.TotalCredit, e.IsBalanced,
        e.Lines.Select(l => new JournalLineDto(
            l.Id, l.AccountId, l.AccountName,
            l.DebitAmount, l.CreditAmount, l.Description)).ToList(),
        e.CreatedAt, e.UpdatedAt);
}
