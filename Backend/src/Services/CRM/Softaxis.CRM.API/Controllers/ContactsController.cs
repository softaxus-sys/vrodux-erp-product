using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Authorization;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Contacts.Commands;
using Softaxis.CRM.Application.Contacts.Queries;

namespace Softaxis.CRM.API.Controllers;

[ApiController][Route("api/crm/contacts")][Authorize]
public sealed class ContactsController(ISender sender) : CrmControllerBase
{
    // GET /api/crm/contacts?customerId=...  (contacts are customer-scoped → gate on crm.customers)
    [HttpGet]
    [RequirePermission("crm.customers.view")]
    public async Task<IActionResult> GetAll([FromQuery] Guid? customerId, CancellationToken ct)
    {
        var result = await sender.Send(new GetContactsQuery(customerId), ct);
        return OkOrError(result);
    }

    [HttpPost]
    [RequirePermission("crm.customers.create")]
    public async Task<IActionResult> Create([FromBody] UpsertContactReq req, CancellationToken ct)
    {
        var result = await sender.Send(new CreateContactCommand(req.CustomerId, req.FirstName, req.LastName,
            req.Title, req.Email, req.Phone, req.Department, req.IsPrimary, req.Notes), ct);
        return OkOrError(result);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("crm.customers.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertContactReq req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateContactCommand(id, req.CustomerId, req.FirstName, req.LastName,
            req.Title, req.Email, req.Phone, req.Department, req.IsPrimary, req.Notes), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/primary")]
    [RequirePermission("crm.customers.edit")]
    public async Task<IActionResult> SetPrimary(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new SetPrimaryContactCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("crm.customers.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteContactCommand(id), ct);
        return NoContentOrError(result);
    }

    public sealed record UpsertContactReq(Guid CustomerId, string FirstName, string LastName, string Title,
        string Email, string Phone, string? Department, bool IsPrimary, string? Notes);
}
