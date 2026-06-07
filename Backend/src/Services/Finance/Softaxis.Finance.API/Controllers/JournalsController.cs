using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.API.Controllers;

/// <summary>
/// Frontend-facing alias at /api/finance/journals with additional /summary endpoint.
/// The original /api/finance/journal-entries controller is preserved for backward compatibility.
/// </summary>
[ApiController]
[Route("api/finance/journals")]
[Authorize]
public sealed class JournalsController(FinanceDbContext db) : ControllerBase
{
    public record JournalLineDto(
        Guid    Id,
        string  AccountCode,
        string  AccountName,
        decimal Debit,
        decimal Credit,
        string? Description);

    public record JournalDto(
        Guid      Id,
        string    JournalNumber,
        string    Date,
        string    Description,
        string?   Reference,
        string    Status,
        string?   Notes,
        decimal   TotalDebit,
        decimal   TotalCredit,
        bool      IsBalanced,
        string    Period,
        string    CreatedBy,
        IReadOnlyList<JournalLineDto> Lines,
        DateTime  CreatedAt,
        DateTime? UpdatedAt);

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.JournalEntries.AsNoTracking()
            .Where(x => !x.IsDeleted)
            .Include(x => x.Lines)
            .Select(x => new
            {
                x.Status,
                x.Date,
                TotalDebit = x.Lines.Sum(l => l.DebitAmount),
            })
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        var thisMonthPrefix = $"{now:yyyy-MM}";

        return Ok(new
        {
            total            = all.Count,
            draft            = all.Count(x => x.Status == "draft"),
            posted           = all.Count(x => x.Status == "posted"),
            reversed         = all.Count(x => x.Status == "reversed"),
            totalPostedValue = all.Where(x => x.Status == "posted").Sum(x => x.TotalDebit),
            thisMonth        = all.Count(x => x.Date.StartsWith(thisMonthPrefix)),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search   = null,
        [FromQuery] string? status   = null,
        CancellationToken ct = default)
    {
        IQueryable<JournalEntry> query = db.JournalEntries.AsNoTracking()
            .Include(x => x.Lines).ThenInclude(l => l.Account)
            .Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x => x.EntryNumber.Contains(search) || x.Description.Contains(search));

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status);

        var items = await query
            .OrderByDescending(x => x.Date)
            .ToListAsync(ct);

        return Ok(items.Select(e => new JournalDto(
            e.Id, e.EntryNumber, e.Date, e.Description, e.Reference, e.Status, e.Notes,
            e.TotalDebit, e.TotalCredit, e.IsBalanced,
            e.Date.Length >= 7 ? e.Date[..7] : e.Date,
            "System",
            e.Lines.Select(l => new JournalLineDto(
                l.Id,
                l.Account?.AccountNumber ?? l.AccountId.ToString()[..8],
                l.AccountName,
                l.DebitAmount,
                l.CreditAmount,
                l.Description)).ToList(),
            e.CreatedAt, e.UpdatedAt)).ToList());
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var e = await db.JournalEntries.AsNoTracking()
            .Include(x => x.Lines).ThenInclude(l => l.Account)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return NotFound();
        return Ok(new JournalDto(
            e.Id, e.EntryNumber, e.Date, e.Description, e.Reference, e.Status, e.Notes,
            e.TotalDebit, e.TotalCredit, e.IsBalanced,
            e.Date.Length >= 7 ? e.Date[..7] : e.Date,
            "System",
            e.Lines.Select(l => new JournalLineDto(
                l.Id,
                l.Account?.AccountNumber ?? l.AccountId.ToString()[..8],
                l.AccountName,
                l.DebitAmount,
                l.CreditAmount,
                l.Description)).ToList(),
            e.CreatedAt, e.UpdatedAt));
    }
}
