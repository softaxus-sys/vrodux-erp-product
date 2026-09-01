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
    // Reads are open to both full-view roles and assigned-only roles; the handlers scope the rows.
    private const string ViewAny = "crm.leads.view";
    private const string ViewTeam = "crm.leads-team.view";
    private const string ViewAssigned = "crm.leads-assigned.view";
    private const string EditAny = "crm.leads.edit";
    private const string EditTeam = "crm.leads-team.edit";
    private const string EditAssigned = "crm.leads-assigned.edit";

    [HttpGet("summary")]
    [RequireAnyPermission(ViewAny, ViewTeam, ViewAssigned)]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetLeadsSummaryQuery(), ct);
        return OkOrError(result);
    }

    /// <summary>
    /// The list screen. Filtering, sorting and paging run in SQL — see <c>GetLeadsPagedQuery</c>
    /// for why the unpaged sibling below is not used here.
    /// </summary>
    [HttpGet("paged")]
    [RequireAnyPermission(ViewAny, ViewTeam, ViewAssigned)]
    public async Task<IActionResult> GetPaged(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] string? source = null,
        [FromQuery] string? assignee = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDesc = true,
        CancellationToken ct = default)
    {
        var result = await sender.Send(
            new GetLeadsPagedQuery(page, pageSize, search, status, source, assignee, sortBy, sortDesc), ct);
        return OkOrError(result);
    }

    /// <summary>Every lead the caller can see. Used by the board view and exports.</summary>
    [HttpGet]
    [RequireAnyPermission(ViewAny, ViewTeam, ViewAssigned)]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await sender.Send(new GetLeadsQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    [RequireAnyPermission(ViewAny, ViewTeam, ViewAssigned)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetLeadByIdQuery(id), ct);
        return OkOrError(result);
    }

    /// <summary>The lead's assignment/handoff history (pipeline trail), newest first.</summary>
    [HttpGet("{id:guid}/assignments")]
    [RequireAnyPermission(ViewAny, ViewTeam, ViewAssigned)]
    public async Task<IActionResult> GetAssignments(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetLeadAssignmentsQuery(id), ct);
        return OkOrError(result);
    }

    /// <summary>
    /// The lead's complete journey — creation, handoffs, status changes, logged activity and
    /// conversion — merged chronologically, newest first.
    /// </summary>
    [HttpGet("{id:guid}/journey")]
    [RequireAnyPermission(ViewAny, ViewTeam, ViewAssigned)]
    public async Task<IActionResult> GetJourney(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetLeadJourneyQuery(id), ct);
        return OkOrError(result);
    }

    [HttpPost]
    [RequirePermission("crm.leads.create")]
    public async Task<IActionResult> Create([FromBody] CreateLeadCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.IsSuccess ? (object?)result.Value.Id : null });
    }

    // Writes are open to full-edit roles and assigned-edit roles; the handlers enforce that an
    // assigned-only user may act only on a lead they currently own.
    [HttpPut("{id:guid}")]
    [RequireAnyPermission(EditAny, EditTeam, EditAssigned)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateLeadRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateLeadCommand(id, req.FirstName, req.LastName, req.Title,
            req.Company, req.Industry, req.Email, req.Phone, req.Country, req.City, req.Source, req.Priority,
            req.EstimatedValue, req.AssignedTo, req.Score, req.NextFollowUp, req.Notes, req.Tags,
            req.WhatsApp, req.InterestedIn, req.Budget, req.Message, req.AssignedToUserId, req.PurchaseTimeframe,
            req.TeamId), ct);
        return NoContentOrError(result);
    }

    [HttpPatch("{id:guid}/status")]
    [RequireAnyPermission(EditAny, EditTeam, EditAssigned)]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] StatusReq req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateLeadStatusCommand(id, req.Status), ct);
        return NoContentOrError(result);
    }

    [HttpPatch("{id:guid}/score")]
    [RequireAnyPermission(EditAny, EditTeam, EditAssigned)]
    public async Task<IActionResult> UpdateScore(Guid id, [FromBody] ScoreReq req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateLeadScoreCommand(id, req.Score), ct);
        return NoContentOrError(result);
    }

    /// <summary>Assign or reassign the lead to a user, recording a handoff in the lead's history.</summary>
    [HttpPost("{id:guid}/assign")]
    [RequireAnyPermission(EditAny, EditTeam, EditAssigned)]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignReq req, CancellationToken ct)
    {
        var result = await sender.Send(new AssignLeadCommand(id, req.ToUserId, req.ToUserName, req.Note, req.TeamId), ct);
        return NoContentOrError(result);
    }

    /// <summary>
    /// File many leads to a team at once (null team un-files them). Each lead is still permission-
    /// checked individually; ones the caller may not edit are skipped and reported, not rejected.
    /// </summary>
    [HttpPost("bulk-file-to-team")]
    [RequireAnyPermission(EditAny, EditTeam, EditAssigned)]
    public async Task<IActionResult> BulkFileToTeam([FromBody] BulkFileReq req, CancellationToken ct)
    {
        var result = await sender.Send(new BulkFileLeadsToTeamCommand(req.LeadIds ?? [], req.TeamId, req.AssignToUserId), ct);
        return OkOrError(result);
    }

    /// <summary>Convert a lead into a customer + an open deal, then mark the lead converted.</summary>
    // Convert mutates the lead and spawns a customer + deal — gate on lead edit (full or assigned-owner).
    [HttpPost("{id:guid}/convert")]
    [RequireAnyPermission(EditAny, EditTeam, EditAssigned)]
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
        string? WhatsApp = null, string? InterestedIn = null, string? Budget = null, string? Message = null,
        Guid? AssignedToUserId = null, string? PurchaseTimeframe = null,
        // Must round-trip: UpdateLeadHandler re-stamps owner + team, so omitting it un-files the lead.
        Guid? TeamId = null);
    public sealed record StatusReq(string Status);
    public sealed record ScoreReq(int Score);
    public sealed record AssignReq(Guid? ToUserId, string ToUserName, string? Note, Guid? TeamId);
    public sealed record BulkFileReq(List<Guid>? LeadIds, Guid? TeamId, Guid? AssignToUserId);
    public sealed record ConvertReq(string? DealTitle, decimal? DealValue, string? ExpectedCloseDate);
}
