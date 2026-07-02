using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Authorization;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Customers.Commands;
using Softaxis.CRM.Application.Customers.Queries;

namespace Softaxis.CRM.API.Controllers;

[ApiController][Route("api/crm/customers")][Authorize]
public sealed class CrmCustomersController(ISender sender) : CrmControllerBase
{
    [HttpGet("summary")]
    [RequirePermission("crm.customers.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetCrmCustomersSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    [RequirePermission("crm.customers.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await sender.Send(new GetCrmCustomersQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("crm.customers.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetCrmCustomerByIdQuery(id), ct);
        return OkOrError(result);
    }

    [HttpPost]
    [RequirePermission("crm.customers.create")]
    public async Task<IActionResult> Create([FromBody] CreateCrmCustomerCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.IsSuccess ? (object?)result.Value.Id : null });
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("crm.customers.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCrmCustomerRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateCrmCustomerCommand(id, req.Name, req.Industry, req.Country, req.City,
            req.Address, req.Phone, req.Email, req.Status, req.Tier, req.AccountManager, req.Description,
            req.Website, req.TradeName, req.Employees, req.NpsScore, req.ContractRenewal, req.Tags), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("crm.customers.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteCrmCustomerCommand(id), ct);
        return NoContentOrError(result);
    }

    public sealed record UpdateCrmCustomerRequest(string Name, string Industry, string Country, string City,
        string Address, string Phone, string Email, string Status, string Tier, string AccountManager,
        string Description, string? Website, string? TradeName, string? Employees, int? NpsScore,
        string? ContractRenewal, List<string>? Tags);
}
