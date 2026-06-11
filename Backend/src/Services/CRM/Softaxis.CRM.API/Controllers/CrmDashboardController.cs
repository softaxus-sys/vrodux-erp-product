using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Dashboard.Queries;

namespace Softaxis.CRM.API.Controllers;

[ApiController][Route("api/crm/dashboard")][Authorize]
public sealed class CrmDashboardController(ISender sender) : CrmControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var result = await sender.Send(new GetCrmDashboardQuery(), ct);
        return OkOrError(result);
    }
}
