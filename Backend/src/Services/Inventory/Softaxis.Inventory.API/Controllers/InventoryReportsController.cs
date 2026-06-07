using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Inventory.Application.Abstractions;

namespace Softaxis.Inventory.API.Controllers;

[Authorize]
[Route("api/inventory/reports")]
[Tags("Inventory Reports")]
public sealed class InventoryReportsController(ISender sender, IInventoryReportService reportService)
    : BaseApiController(sender)
{
    /// <summary>Run any named inventory report with filters.</summary>
    [HttpGet("{reportId}")]
    public async Task<IActionResult> RunReport(
        string  reportId,
        [FromQuery] DateTime? from            = null,
        [FromQuery] DateTime? to              = null,
        [FromQuery] Guid?     warehouseId     = null,
        [FromQuery] Guid?     categoryId      = null,
        [FromQuery] string?   valuationMethod  = null,
        [FromQuery] string?   movementType    = null,
        [FromQuery] string?   fiscalYear      = null,
        [FromQuery] string?   itcStatus       = null,
        [FromQuery] string?   writeOffReason  = null,
        [FromQuery] string?   fromProvince    = null,
        [FromQuery] int       idleDays        = 90,
        [FromQuery] int       expiryWindowDays = 30,
        CancellationToken ct = default)
    {
        var p = new InvReportParams(
            from?.Date         ?? DateTime.UtcNow.AddDays(-30).Date,
            to?.Date           ?? DateTime.UtcNow.Date,
            warehouseId, categoryId, valuationMethod,
            movementType, fiscalYear, itcStatus, writeOffReason, fromProvince,
            idleDays, expiryWindowDays);

        var result = await reportService.RunReportAsync(reportId, p, ct);
        return Ok(result);
    }
}
