using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.Reports.Queries;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/ap")]
[Authorize]
public sealed class PayablesController(ISender sender) : FinanceControllerBase
{
    [HttpGet("aging")]
    public async Task<IActionResult> GetAging([FromQuery] string? asOf, CancellationToken ct)
    {
        var result = await sender.Send(new GetApAgingQuery(asOf), ct);
        return OkOrError(result);
    }

    [HttpGet("statement/{supplierId:guid}")]
    public async Task<IActionResult> GetStatement(Guid supplierId, [FromQuery] string? from, [FromQuery] string? to, CancellationToken ct)
    {
        var result = await sender.Send(new GetSupplierStatementQuery(supplierId, from, to), ct);
        return OkOrError(result);
    }
}
