using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Authorization;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.PortalListings.Commands;
using Softaxis.CRM.Application.PortalListings.Queries;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// Agents' registered portal listings — what routes a listing-only portal enquiry (Bayut WhatsApp)
/// to the agent who published it.
///
/// Gated on the lead tiers because a listing is the front door of that agent's leads. The attribute
/// is the coarse gate; the handlers decide per listing (own / team lead / full access).
/// </summary>
[ApiController][Route("api/crm/portal-listings")][Authorize]
public sealed class PortalListingsController(ISender sender) : CrmControllerBase
{
    private const string ViewAny = "crm.leads.view", ViewTeam = "crm.leads-team.view", ViewAssigned = "crm.leads-assigned.view";
    private const string Create = "crm.leads.create", EditAny = "crm.leads.edit", EditTeam = "crm.leads-team.edit", EditAssigned = "crm.leads-assigned.edit";

    [HttpGet]
    [RequireAnyPermission(ViewAny, ViewTeam, ViewAssigned)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search, [FromQuery] string? portal, [FromQuery] bool mine = false, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetPortalListingsQuery(search, portal, mine), ct));

    [HttpPost]
    [RequireAnyPermission(Create, EditAny, EditTeam, EditAssigned)]
    public async Task<IActionResult> Create_([FromBody] CreatePortalListingCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpPost("import")]
    [RequireAnyPermission(Create, EditAny, EditTeam, EditAssigned)]
    public async Task<IActionResult> Import([FromBody] ImportPortalListingsCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpPut("{id:guid}")]
    [RequireAnyPermission(Create, EditAny, EditTeam, EditAssigned)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePortalListingRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdatePortalListingCommand(
            id, req.Reference, req.Url, req.Title, req.AgentUserId, req.TeamId, req.IsActive), ct));

    [HttpDelete("{id:guid}")]
    [RequireAnyPermission(Create, EditAny, EditTeam, EditAssigned)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeletePortalListingCommand(id), ct));
}

public sealed record UpdatePortalListingRequest(
    string? Reference, string? Url, string? Title, Guid AgentUserId, Guid? TeamId, bool IsActive);
