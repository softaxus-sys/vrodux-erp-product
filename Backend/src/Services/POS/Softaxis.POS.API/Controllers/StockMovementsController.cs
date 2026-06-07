using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.Application.StockMovements.Queries.GetStockMovements;

namespace Softaxis.POS.API.Controllers;

[Authorize]
[Route("api/stock-movements")]
[Tags("StockMovements")]
public sealed class StockMovementsController(ISender sender) : BaseApiController(sender)
{
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] Guid?   productId = null,
        [FromQuery] string? type      = null,
        [FromQuery] string? from      = null,
        [FromQuery] string? to        = null,
        [FromQuery] int     page      = 1,
        [FromQuery] int     pageSize  = 25,
        CancellationToken ct = default) =>
        HandleResult(await Sender.Send(
            new GetStockMovementsQuery(productId, type, from, to, page, pageSize), ct));
}
