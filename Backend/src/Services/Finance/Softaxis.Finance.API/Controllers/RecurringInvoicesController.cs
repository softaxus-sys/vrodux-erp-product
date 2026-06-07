using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;
using Softaxis.Finance.Infrastructure.Services;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/recurring-invoices")]
[Authorize]
public sealed class RecurringInvoicesController(FinanceDbContext db) : ControllerBase
{
    public record LineDto(Guid Id, string Description, decimal Quantity, decimal UnitPrice);
    public record RecurringDto(
        Guid Id, string TemplateName, string CustomerName, string? CustomerEmail,
        string Frequency, string StartDate, string? EndDate, string NextRunDate,
        int DueDays, decimal TaxRate, string? Notes, bool IsActive,
        string? LastGeneratedDate, int GeneratedCount,
        decimal SubTotal, decimal Total, IReadOnlyList<LineDto> Lines);

    public record LineReq(string Description, decimal Quantity, decimal UnitPrice);
    public record UpsertReq(
        string TemplateName, string CustomerName, string? CustomerEmail,
        string Frequency, string StartDate, string? EndDate,
        int DueDays, decimal TaxRate, string? Notes, IReadOnlyList<LineReq> Lines);

    private static RecurringDto ToDto(RecurringInvoice r)
    {
        var sub = r.Lines.Sum(l => l.Quantity * l.UnitPrice);
        return new RecurringDto(
            r.Id, r.TemplateName, r.CustomerName, r.CustomerEmail,
            r.Frequency, r.StartDate.ToString("yyyy-MM-dd"), r.EndDate?.ToString("yyyy-MM-dd"),
            r.NextRunDate.ToString("yyyy-MM-dd"), r.DueDays, r.TaxRate, r.Notes, r.IsActive,
            r.LastGeneratedDate?.ToString("yyyy-MM-dd"), r.GeneratedCount,
            sub, Math.Round(sub + sub * r.TaxRate / 100m, 2),
            r.Lines.Select(l => new LineDto(l.Id, l.Description, l.Quantity, l.UnitPrice)).ToList());
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var items = await db.RecurringInvoices.AsNoTracking().Include(r => r.Lines)
            .OrderByDescending(r => r.IsActive).ThenBy(r => r.NextRunDate).ToListAsync(ct);
        return Ok(items.Select(ToDto));
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.RecurringInvoices.AsNoTracking().Include(r => r.Lines).ToListAsync(ct);
        var today = DateTime.UtcNow.Date;
        return Ok(new
        {
            total          = all.Count,
            active         = all.Count(r => r.IsActive),
            dueSoon        = all.Count(r => r.IsActive && r.NextRunDate.Date <= today.AddDays(7)),
            generatedTotal = all.Sum(r => r.GeneratedCount),
            monthlyValue   = all.Where(r => r.IsActive && r.Frequency == "monthly")
                                 .Sum(r => { var s = r.Lines.Sum(l => l.Quantity * l.UnitPrice); return s + s * r.TaxRate / 100m; }),
        });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var r = await db.RecurringInvoices.AsNoTracking().Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == id, ct);
        return r is null ? NotFound() : Ok(ToDto(r));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertReq req, CancellationToken ct)
    {
        if (req.Lines.Count == 0) return BadRequest(new { error = "At least one line item is required." });
        var r = new RecurringInvoice(req.TemplateName, req.CustomerName, req.CustomerEmail,
            req.Frequency, ParseDate(req.StartDate), ParseNullableDate(req.EndDate),
            req.DueDays, req.TaxRate, req.Notes);
        foreach (var l in req.Lines)
            r.Lines.Add(new RecurringInvoiceLine(r.Id, l.Description, l.Quantity, l.UnitPrice));
        db.RecurringInvoices.Add(r);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = r.Id }, ToDto(r));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertReq req, CancellationToken ct)
    {
        var r = await db.RecurringInvoices.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (r is null) return NotFound();
        r.Update(req.TemplateName, req.CustomerName, req.CustomerEmail, req.Frequency,
            ParseNullableDate(req.EndDate), req.DueDays, req.TaxRate, req.Notes);
        db.RecurringInvoiceLines.RemoveRange(r.Lines);
        foreach (var l in req.Lines)
            r.Lines.Add(new RecurringInvoiceLine(r.Id, l.Description, l.Quantity, l.UnitPrice));
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/pause")]
    public async Task<IActionResult> Pause(Guid id, CancellationToken ct) => await Toggle(id, pause: true, ct);

    [HttpPost("{id:guid}/resume")]
    public async Task<IActionResult> Resume(Guid id, CancellationToken ct) => await Toggle(id, pause: false, ct);

    private async Task<IActionResult> Toggle(Guid id, bool pause, CancellationToken ct)
    {
        var r = await db.RecurringInvoices.FindAsync([id], ct);
        if (r is null) return NotFound();
        if (pause) r.Pause(); else r.Resume();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var r = await db.RecurringInvoices.FindAsync([id], ct);
        if (r is null) return NotFound();
        r.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>Generate one invoice now from this template (advances the schedule).</summary>
    [HttpPost("{id:guid}/generate")]
    public async Task<IActionResult> GenerateNow(Guid id, CancellationToken ct)
    {
        var r = await db.RecurringInvoices.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (r is null) return NotFound();
        var invoice = RecurringInvoiceGenerator.GenerateInvoice(r, DateTime.UtcNow);
        db.Invoices.Add(invoice);
        r.AdvanceAfterGeneration();
        await db.SaveChangesAsync(ct);
        return Ok(new { invoiceId = invoice.Id, invoice.InvoiceNumber });
    }

    /// <summary>Generate invoices for every template that is currently due.</summary>
    [HttpPost("run-due")]
    public async Task<IActionResult> RunDue(CancellationToken ct)
    {
        var created = await RecurringInvoiceGenerator.GenerateDueAsync(db, DateTime.UtcNow, ct);
        return Ok(new { generated = created });
    }

    private static DateTime ParseDate(string s) =>
        DateTime.TryParse(s, out var d) ? d : DateTime.UtcNow.Date;
    private static DateTime? ParseNullableDate(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : (DateTime.TryParse(s, out var d) ? d : null);
}
