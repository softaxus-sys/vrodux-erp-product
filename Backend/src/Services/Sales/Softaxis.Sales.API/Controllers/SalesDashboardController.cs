using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Sales.API.Authorization;
using Softaxis.Sales.API.Controllers.Common;
using Softaxis.Sales.Application.Dashboard.Queries;

namespace Softaxis.Sales.API.Controllers;

/// <summary>
/// Read-only aggregates for the dashboard's sales charts.
///
/// <para>Deliberately its own controller rather than another action on <c>SalesOrdersController</c>:
/// that one injects <c>SalesDbContext</c> directly and is flagged tech debt, and the architecture
/// rule is to follow the CQRS pattern for new work rather than compound the existing violation.</para>
/// </summary>
[Route("api/sales/dashboard")]
[Authorize]
public sealed class SalesDashboardController(ISender sender) : SalesControllerBase
{
    [HttpGet]
    [RequirePermission("sales.orders.view")]
    public async Task<IActionResult> Get([FromQuery] int? year, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetSalesDashboardQuery(year), ct));
}
