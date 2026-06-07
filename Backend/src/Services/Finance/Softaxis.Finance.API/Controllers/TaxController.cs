using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/tax")]
[Authorize]
public sealed class TaxController(FinanceDbContext db) : ControllerBase
{
    public record TaxPeriodDto(
        Guid     Id,
        string   Period,
        string   From,
        string   To,
        string   Status,
        decimal  OutputVat,
        decimal  InputVat,
        decimal  NetVat,
        string   DueDate,
        string?  FiledDate,
        string?  PaidDate,
        decimal? Penalty);

    public record TaxTxDto(
        Guid    Id,
        string  Date,
        string  Type,
        string  Reference,
        decimal Amount,
        decimal VatAmount,
        decimal VatRate,
        string  Description,
        string  Period);

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var periods = await db.TaxPeriods.AsNoTracking()
            .OrderByDescending(x => x.Period)
            .ToListAsync(ct);

        var current = periods.FirstOrDefault(p => p.Status == "open") ?? periods.FirstOrDefault();

        return Ok(new
        {
            currentPeriodOutput    = current?.OutputVat ?? 0m,
            currentPeriodInput     = current?.InputVat ?? 0m,
            currentNetVat          = current?.NetVat ?? 0m,
            ytdVatPaid             = periods.Where(p => p.Status == "paid").Sum(p => p.NetVat),
            nextDueDate            = current?.DueDate ?? "",
            currentPeriod          = current?.Period ?? "",
            registrationNumber     = "TRN-100234567890003",
        });
    }

    [HttpGet("periods")]
    public async Task<IActionResult> GetPeriods(CancellationToken ct)
    {
        var items = await db.TaxPeriods.AsNoTracking()
            .OrderByDescending(x => x.Period)
            .Select(x => new TaxPeriodDto(
                x.Id, x.Period, x.FromDate, x.ToDate, x.Status,
                x.OutputVat, x.InputVat, x.OutputVat - x.InputVat,   // NetVat is ignored by EF — compute inline
                x.DueDate, x.FiledDate, x.PaidDate, x.Penalty))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpPost("periods/{id:guid}/file")]
    public async Task<IActionResult> FilePeriod(Guid id, CancellationToken ct)
    {
        var period = await db.TaxPeriods.FindAsync([id], ct);
        if (period is null) return NotFound();
        if (period.Status is "filed" or "paid")
            return BadRequest(new { error = "Period is already filed." });
        period.File(DateTime.UtcNow.ToString("yyyy-MM-dd"));
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("periods/{id:guid}/pay")]
    public async Task<IActionResult> PayPeriod(Guid id, CancellationToken ct)
    {
        var period = await db.TaxPeriods.FindAsync([id], ct);
        if (period is null) return NotFound();
        if (period.Status == "paid")
            return BadRequest(new { error = "Period is already paid." });
        if (period.Status == "open")
            return BadRequest(new { error = "File the return before recording payment." });
        period.MarkPaid(DateTime.UtcNow.ToString("yyyy-MM-dd"));
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("transactions")]
    public async Task<IActionResult> GetTransactions(CancellationToken ct)
    {
        var items = await db.TaxTransactions.AsNoTracking()
            .Include(x => x.Period)
            .OrderByDescending(x => x.Date)
            .Select(x => new TaxTxDto(
                x.Id, x.Date, x.Type, x.Reference,
                x.Amount, x.VatAmount, x.VatRate, x.Description,
                x.Period != null ? x.Period.Period : ""))
            .ToListAsync(ct);

        return Ok(items);
    }
}
