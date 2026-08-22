using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Authorization;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Dashboard.Queries;

namespace Softaxis.CRM.API.Controllers;

// Read-only CRM overview. Open to EVERY lead-view tier, not just the tenant-wide one: the handler
// scopes each figure to what the caller may actually see, so a team lead gets their team's numbers
// rather than a 403. Gating on crm.leads.view alone meant every team-tier and assigned-tier user got
// a permission failure here, which the UI rendered as a dashboard stuck on "Loading…" forever.
[ApiController][Route("api/crm/dashboard")][Authorize]
[RequireAnyPermission("crm.leads.view", "crm.leads-team.view", "crm.leads-assigned.view")]
public sealed class CrmDashboardController(ISender sender) : CrmControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var result = await sender.Send(new GetCrmDashboardQuery(), ct);
        return OkOrError(result);
    }
}
