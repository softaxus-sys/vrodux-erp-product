using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.Tax.Commands;
using Softaxis.Finance.Application.Tax.Queries;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/tax")]
[Authorize]
public sealed class TaxController(ISender sender) : FinanceControllerBase
{
    [HttpGet("summary")]
    [RequirePermission("finance.tax.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetTaxSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet("periods")]
    [RequirePermission("finance.tax.view")]
    public async Task<IActionResult> GetPeriods(CancellationToken ct)
    {
        var result = await sender.Send(new GetTaxPeriodsQuery(), ct);
        return OkOrError(result);
    }

    [HttpPost("periods")]
    [RequirePermission("finance.tax.create")]
    public async Task<IActionResult> CreatePeriod([FromBody] CreateTaxPeriodCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetPeriods),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    [HttpPost("periods/{id:guid}/file")]
    [RequirePermission("finance.tax.approve")]
    public async Task<IActionResult> FilePeriod(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new FileTaxPeriodCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpPost("periods/{id:guid}/pay")]
    [RequirePermission("finance.tax.edit")]
    public async Task<IActionResult> PayPeriod(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new PayTaxPeriodCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpGet("transactions")]
    [RequirePermission("finance.tax.view")]
    public async Task<IActionResult> GetTransactions([FromQuery] string? period = null, CancellationToken ct = default)
    {
        var result = await sender.Send(new GetTaxTransactionsQuery(period), ct);
        return OkOrError(result);
    }
}
