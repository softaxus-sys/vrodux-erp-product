using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Purchase.API.Authorization;
using Softaxis.Purchase.API.Controllers.Common;
using Softaxis.Purchase.Application.Dashboard.Queries;

namespace Softaxis.Purchase.API.Controllers;

/// <summary>
/// Read-only aggregates for the dashboard's purchase charts.
///
/// <para>Its own controller rather than another action on <c>PurchaseOrdersController</c>: that one
/// injects <c>PurchaseDbContext</c> directly and is flagged tech debt, and the architecture rule is
/// to follow the CQRS pattern for new work rather than compound the existing violation.</para>
/// </summary>
[Route("api/purchase/dashboard")]
[Authorize]
public sealed class PurchaseDashboardController(ISender sender) : PurchaseControllerBase
{
    [HttpGet]
    [RequirePermission("purchase.orders.view")]
    public async Task<IActionResult> Get([FromQuery] int? year, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetPurchaseDashboardQuery(year), ct));
}
