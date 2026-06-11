using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.GeneralLedger.Queries;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/gl")]
[Authorize]
public sealed class GeneralLedgerController(ISender sender) : FinanceControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetGlSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet("trial-balance")]
    public async Task<IActionResult> GetTrialBalance(CancellationToken ct)
    {
        var result = await sender.Send(new GetTrialBalanceQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet("profit-loss")]
    public async Task<IActionResult> GetProfitLoss([FromQuery] string? from, [FromQuery] string? to, CancellationToken ct)
    {
        var result = await sender.Send(new GetProfitLossQuery(from, to), ct);
        return OkOrError(result);
    }

    [HttpGet("balance-sheet")]
    public async Task<IActionResult> GetBalanceSheet([FromQuery] string? asOf, CancellationToken ct)
    {
        var result = await sender.Send(new GetBalanceSheetQuery(asOf), ct);
        return OkOrError(result);
    }

    [HttpGet("cash-flow")]
    public async Task<IActionResult> GetCashFlow([FromQuery] string? from, [FromQuery] string? to, CancellationToken ct)
    {
        var result = await sender.Send(new GetCashFlowQuery(from, to), ct);
        return OkOrError(result);
    }
}
