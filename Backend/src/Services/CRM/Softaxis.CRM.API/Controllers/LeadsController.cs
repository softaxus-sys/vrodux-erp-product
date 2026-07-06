using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Authorization;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Application.Leads.Queries;

namespace Softaxis.CRM.API.Controllers;

[ApiController][Route("api/crm/leads")][Authorize]
public sealed class LeadsController(ISender sender) : CrmControllerBase
{
    [HttpGet("summary")]
    [RequirePermission("crm.leads.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetLeadsSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    [RequirePermission("crm.leads.view")]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await sender.Send(new GetLeadsQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("crm.leads.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetLeadByIdQuery(id), ct);
        return OkOrError(result);
    }

    [HttpPost]
    [RequirePermission("crm.leads.create")]
    public async Task<IActionResult> Create([FromBody] CreateLeadCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.IsSuccess ? (object?)result.Value.Id : null });
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("crm.leads.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateLeadRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateLeadCommand(id, req.FirstName, req.LastName, req.Title,
            req.Company, req.Industry, req.Email, req.Phone, req.Country, req.City, req.Source, req.Priority,
            req.EstimatedValue, req.AssignedTo, req.Score, req.NextFollowUp, req.Notes, req.Tags,
            req.WhatsApp, req.InterestedIn, req.Budget, req.Message), ct);
        return NoContentOrError(result);
    }

    [HttpPatch("{id:guid}/status")]
    [RequirePermission("crm.leads.edit")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] StatusReq req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateLeadStatusCommand(id, req.Status), ct);
        return NoContentOrError(result);
    }

    [HttpPatch("{id:guid}/score")]
    [RequirePermission("crm.leads.edit")]
    public async Task<IActionResult> UpdateScore(Guid id, [FromBody] ScoreReq req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateLeadScoreCommand(id, req.Score), ct);
        return NoContentOrError(result);
    }

    /// <summary>Convert a lead into a customer + an open deal, then mark the lead converted.</summary>
    // Convert mutates the lead and spawns a customer + deal — gate on lead edit.
    [HttpPost("{id:guid}/convert")]
    [RequirePermission("crm.leads.edit")]
    public async Task<IActionResult> Convert(Guid id, [FromBody] ConvertReq req, CancellationToken ct)
    {
        var result = await sender.Send(new ConvertLeadCommand(id, req.DealTitle, req.DealValue, req.ExpectedCloseDate), ct);
        return OkOrError(result);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("crm.leads.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteLeadCommand(id), ct);
        return NoContentOrError(result);
    }

    public sealed record UpdateLeadRequest(string FirstName, string LastName, string Title, string Company, string Industry,
        string Email, string Phone, string Country, string City, string Source, string Priority,
        decimal EstimatedValue, string AssignedTo, int Score, string? NextFollowUp, string? Notes, List<string>? Tags,
        string? WhatsApp = null, string? InterestedIn = null, string? Budget = null, string? Message = null);
    public sealed record StatusReq(string Status);
    public sealed record ScoreReq(int Score);
    public sealed record ConvertReq(string? DealTitle, decimal? DealValue, string? ExpectedCloseDate);
}
