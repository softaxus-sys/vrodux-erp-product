using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.FiscalPeriods.Commands;
using Softaxis.Finance.Application.FiscalPeriods.Queries;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/fiscal-periods")]
[Authorize]
public sealed class FiscalPeriodsController(ISender sender) : FinanceControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? year, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetFiscalPeriodsQuery(year), ct));

    [HttpPost("close")]
    public async Task<IActionResult> Close([FromBody] ClosePeriodRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new ClosePeriodCommand(req.PeriodCode, req.ClosedByName), ct));

    [HttpPost("reopen")]
    public async Task<IActionResult> Reopen([FromBody] ReopenPeriodRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new ReopenPeriodCommand(req.PeriodCode), ct));

    public sealed record ClosePeriodRequest(string PeriodCode, string? ClosedByName);

    public sealed record ReopenPeriodRequest(string PeriodCode);
}
