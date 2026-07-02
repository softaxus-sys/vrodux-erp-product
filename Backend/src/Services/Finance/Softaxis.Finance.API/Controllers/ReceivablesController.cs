using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.Reports.Queries;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/ar")]
[Authorize]
[RequirePermission("finance.invoicing.view")]
public sealed class ReceivablesController(ISender sender) : FinanceControllerBase
{
    [HttpGet("aging")]
    public async Task<IActionResult> GetAging([FromQuery] string? asOf, CancellationToken ct)
    {
        var result = await sender.Send(new GetArAgingQuery(asOf), ct);
        return OkOrError(result);
    }

    [HttpGet("statement/{customerId:guid}")]
    public async Task<IActionResult> GetStatement(Guid customerId, [FromQuery] string? from, [FromQuery] string? to, CancellationToken ct)
    {
        var result = await sender.Send(new GetCustomerStatementQuery(customerId, from, to), ct);
        return OkOrError(result);
    }
}
