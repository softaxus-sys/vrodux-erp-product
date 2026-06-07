using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Application.Reports.Queries.GetDailySummary;
using MediatR;

namespace Softaxis.POS.API.Controllers;

[Authorize]
public sealed class ReportsController(ISender sender, IReportService reportService) : BaseApiController(sender)
{
    /// <summary>Get the daily sales summary for a given date (used by cashier dashboard).</summary>
    [HttpGet("daily-summary")]
    public async Task<IActionResult> GetDailySummary(
        [FromQuery] DateTime? date = null,
        [FromQuery] Guid? cashierId = null,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(
            new GetDailySummaryQuery(date?.Date ?? DateTime.UtcNow.Date, cashierId), ct));

    /// <summary>Run any named POS report with filters.</summary>
    [HttpGet("{reportId}")]
    public async Task<IActionResult> RunReport(
        string reportId,
        [FromQuery] DateTime? from          = null,
        [FromQuery] DateTime? to            = null,
        [FromQuery] Guid?     cashierId     = null,
        [FromQuery] Guid?     categoryId    = null,
        [FromQuery] Guid?     warehouseId   = null,
        [FromQuery] string?   paymentMethod  = null,
        [FromQuery] string?   status        = null,
        [FromQuery] string?   taxPeriod     = null,
        [FromQuery] string?   valuationMethod = null,
        [FromQuery] string?   fiscalYear    = null,
        [FromQuery] int       idleDays      = 90,
        CancellationToken ct = default)
    {
        var p = new ReportParams(
            from?.Date          ?? DateTime.UtcNow.AddDays(-30).Date,
            to?.Date            ?? DateTime.UtcNow.Date,
            cashierId, categoryId, warehouseId,
            paymentMethod, status, taxPeriod, valuationMethod, fiscalYear, idleDays);

        var result = await reportService.RunReportAsync(reportId, p, ct);
        return Ok(result);
    }
}
