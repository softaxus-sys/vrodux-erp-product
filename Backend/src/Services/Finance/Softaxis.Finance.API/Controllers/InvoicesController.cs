using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/invoices")]
[Authorize]
public sealed class InvoicesController(FinanceDbContext db) : ControllerBase
{
    public record InvoiceItemDto(
        Guid    Id,
        string  Description,
        decimal Quantity,
        decimal UnitPrice,
        decimal LineTotal);

    public record InvoiceSummaryDto(
        Guid      Id,
        string    InvoiceNumber,
        string    CustomerName,
        string?   CustomerEmail,
        string    InvoiceDate,
        string    DueDate,
        decimal   TaxRate,
        decimal   SubTotal,
        decimal   TaxAmount,
        decimal   Total,
        string    Status,
        int       ItemCount,
        DateTime? PaidAt,
        DateTime  CreatedAt,
        DateTime? UpdatedAt);

    public record InvoiceDto(
        Guid      Id,
        string    InvoiceNumber,
        string    CustomerName,
        string?   CustomerEmail,
        string    InvoiceDate,
        string    DueDate,
        decimal   TaxRate,
        decimal   SubTotal,
        decimal   TaxAmount,
        decimal   Total,
        string    Status,
        string?   Notes,
        IReadOnlyList<InvoiceItemDto> Items,
        DateTime? PaidAt,
        DateTime  CreatedAt,
        DateTime? UpdatedAt);

    public record InvoiceItemRequest(
        string  Description,
        decimal Quantity,
        decimal UnitPrice);

    public record CreateInvoiceRequest(
        string  CustomerName,
        string? CustomerEmail,
        string  InvoiceDate,
        string  DueDate,
        decimal TaxRate,
        string? Notes,
        IReadOnlyList<InvoiceItemRequest> Items);

    public record UpdateInvoiceRequest(
        string  CustomerName,
        string? CustomerEmail,
        string  InvoiceDate,
        string  DueDate,
        decimal TaxRate,
        string? Notes,
        string  Status,
        IReadOnlyList<InvoiceItemRequest> Items);

    public record PagedResult<T>(
        IReadOnlyList<T> Items, int Page, int PageSize,
        int TotalCount, int TotalPages, bool HasNext, bool HasPrev);

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var all = await db.Invoices.AsNoTracking().Include(x => x.Items)
            .Select(x => new { x.Status, Total = x.Items.Sum(i => i.Quantity * i.UnitPrice) * (1 + x.TaxRate / 100) })
            .ToListAsync(ct);

        return Ok(new
        {
            totalInvoices    = all.Count,
            totalAmount      = all.Sum(x => x.Total),
            totalPaid        = all.Where(x => x.Status == "paid").Sum(x => x.Total),
            totalOverdue     = all.Where(x => x.Status == "overdue").Sum(x => x.Total),
            totalOutstanding = all.Where(x => x.Status is "sent" or "overdue").Sum(x => x.Total),
            draftCount       = all.Count(x => x.Status == "draft"),
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20,
        [FromQuery] string? search   = null,
        [FromQuery] string? status   = null,
        CancellationToken ct = default)
    {
        IQueryable<Invoice> query = db.Invoices.AsNoTracking().Include(x => x.Items);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(x => x.InvoiceNumber.Contains(search) || x.CustomerName.Contains(search));

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status);

        var total      = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling((double)total / pageSize);

        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new InvoiceSummaryDto(
                x.Id, x.InvoiceNumber, x.CustomerName, x.CustomerEmail,
                x.InvoiceDate, x.DueDate, x.TaxRate,
                x.Items.Sum(i => i.Quantity * i.UnitPrice),
                x.Items.Sum(i => i.Quantity * i.UnitPrice) * x.TaxRate / 100,
                x.Items.Sum(i => i.Quantity * i.UnitPrice) + x.Items.Sum(i => i.Quantity * i.UnitPrice) * x.TaxRate / 100,
                x.Status, x.Items.Count, x.PaidAt, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Ok(new PagedResult<InvoiceSummaryDto>(items, page, pageSize, total, totalPages,
            page < totalPages, page > 1));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var inv = await db.Invoices.AsNoTracking().Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        return inv is null ? NotFound() : Ok(ToDto(inv));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateInvoiceRequest req, CancellationToken ct)
    {
        var invoice = new Invoice(req.CustomerName, req.CustomerEmail,
            req.InvoiceDate, req.DueDate, req.TaxRate, req.Notes);

        foreach (var item in req.Items)
            invoice.Items.Add(new InvoiceItem(invoice.Id, item.Description, item.Quantity, item.UnitPrice));

        db.Invoices.Add(invoice);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = invoice.Id }, ToDto(invoice));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateInvoiceRequest req, CancellationToken ct)
    {
        var invoice = await db.Invoices.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (invoice is null) return NotFound();

        invoice.Update(req.CustomerName, req.CustomerEmail, req.InvoiceDate, req.DueDate,
            req.TaxRate, req.Notes, req.Status);

        db.InvoiceItems.RemoveRange(invoice.Items);
        invoice.Items.Clear();
        foreach (var item in req.Items)
            invoice.Items.Add(new InvoiceItem(invoice.Id, item.Description, item.Quantity, item.UnitPrice));

        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/pay")]
    public async Task<IActionResult> MarkPaid(Guid id, CancellationToken ct)
    {
        var invoice = await db.Invoices.FindAsync([id], ct);
        if (invoice is null) return NotFound();
        if (invoice.Status == "paid") return BadRequest(new { error = "Invoice is already paid." });
        invoice.MarkPaid();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/send")]
    public async Task<IActionResult> Send(Guid id, CancellationToken ct)
    {
        var invoice = await db.Invoices.FindAsync([id], ct);
        if (invoice is null) return NotFound();
        if (invoice.Status != "draft")
            return BadRequest(new { error = "Only draft invoices can be sent." });
        invoice.Send();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var invoice = await db.Invoices.FindAsync([id], ct);
        if (invoice is null) return NotFound();
        invoice.Cancel();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var invoice = await db.Invoices.FindAsync([id], ct);
        if (invoice is null) return NotFound();
        invoice.Delete();
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static InvoiceDto ToDto(Invoice x) => new(
        x.Id, x.InvoiceNumber, x.CustomerName, x.CustomerEmail,
        x.InvoiceDate, x.DueDate, x.TaxRate, x.SubTotal, x.TaxAmount, x.Total,
        x.Status, x.Notes,
        x.Items.Select(i => new InvoiceItemDto(i.Id, i.Description, i.Quantity, i.UnitPrice, i.LineTotal)).ToList(),
        x.PaidAt, x.CreatedAt, x.UpdatedAt);
}
