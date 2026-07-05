using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Authorization;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.DealContacts.Commands;
using Softaxis.CRM.Application.DealContacts.Queries;

namespace Softaxis.CRM.API.Controllers;

// Contact roles on an opportunity (route is deal-scoped) → gate on crm.pipeline.
[ApiController][Route("api/crm/deals/{dealId:guid}/contacts")][Authorize]
public sealed class DealContactsController(ISender sender) : CrmControllerBase
{
    [HttpGet]
    [RequirePermission("crm.pipeline.view")]
    public async Task<IActionResult> GetAll(Guid dealId, CancellationToken ct)
    {
        var result = await sender.Send(new GetDealContactsQuery(dealId), ct);
        return OkOrError(result);
    }

    [HttpPost]
    [RequirePermission("crm.pipeline.edit")]
    public async Task<IActionResult> Add(Guid dealId, [FromBody] AddDealContactReq req, CancellationToken ct)
    {
        var result = await sender.Send(new AddDealContactCommand(dealId, req.ContactId, req.Role), ct);
        return OkOrError(result);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("crm.pipeline.edit")]
    public async Task<IActionResult> UpdateRole(Guid dealId, Guid id, [FromBody] UpdateRoleReq req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateDealContactRoleCommand(dealId, id, req.Role), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("crm.pipeline.edit")]
    public async Task<IActionResult> Remove(Guid dealId, Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new RemoveDealContactCommand(dealId, id), ct);
        return NoContentOrError(result);
    }

    public sealed record AddDealContactReq(Guid ContactId, string Role);
    public sealed record UpdateRoleReq(string Role);
}
