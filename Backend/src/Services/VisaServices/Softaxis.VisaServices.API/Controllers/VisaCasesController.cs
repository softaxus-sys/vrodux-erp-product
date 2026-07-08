using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.VisaServices.API.Authorization;
using Softaxis.VisaServices.API.Controllers.Common;
using Softaxis.VisaServices.Application.VisaCases.Commands;
using Softaxis.VisaServices.Application.VisaCases.Queries;

namespace Softaxis.VisaServices.API.Controllers;

[ApiController][Route("api/visa/cases")][Authorize]
public sealed class VisaCasesController(ISender sender) : VisaControllerBase
{
    [HttpGet("summary")]
    [RequirePermission("visa.cases.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetVisaCasesSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet("dashboard")]
    [RequirePermission("visa.cases.view")]
    public async Task<IActionResult> GetDashboard(CancellationToken ct)
    {
        var result = await sender.Send(new GetVisaDashboardQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet("renewals")]
    [RequirePermission("visa.cases.view")]
    public async Task<IActionResult> GetRenewals([FromQuery] int withinDays, CancellationToken ct)
    {
        var result = await sender.Send(new GetVisaRenewalsQuery(withinDays <= 0 ? 90 : withinDays), ct);
        return OkOrError(result);
    }

    [HttpGet]
    [RequirePermission("visa.cases.view")]
    public async Task<IActionResult> GetAll([FromQuery] string? status, [FromQuery] Guid? customerId, CancellationToken ct)
    {
        var result = await sender.Send(new GetVisaCasesQuery(status, customerId), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("visa.cases.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetVisaCaseByIdQuery(id), ct);
        return OkOrError(result);
    }

    [HttpPost]
    [RequirePermission("visa.cases.create")]
    public async Task<IActionResult> Create([FromBody] CreateVisaCaseRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new CreateVisaCaseCommand(req.VisaTypeId, req.Emirate ?? "",
            req.CustomerName, req.CustomerId, req.Priority ?? "medium", req.AssignedTo ?? "",
            req.ServiceFee, req.GovtFee, req.SlaDueDate, req.Notes, req.Applicants,
            req.CreatedByName ?? User.Identity?.Name ?? ""), ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.Value?.Id });
    }

    [HttpPatch("{id:guid}/status")]
    [RequirePermission("visa.cases.edit")]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] ChangeStatusRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new ChangeCaseStatusCommand(id, req.Status, req.GovtReference,
            req.RejectionReason, req.VisaExpiryDate, req.Note, req.ByName ?? User.Identity?.Name ?? ""), ct);
        return NoContentOrError(result);
    }

    [HttpPatch("{id:guid}/assign")]
    [RequirePermission("visa.cases.edit")]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new AssignCaseCommand(id, req.AssignedTo, req.ByName ?? User.Identity?.Name ?? ""), ct);
        return NoContentOrError(result);
    }

    [HttpPut("{id:guid}/documents/{documentId:guid}")]
    [RequirePermission("visa.cases.edit")]
    public async Task<IActionResult> UpdateDocument(Guid id, Guid documentId, [FromBody] UpdateDocumentRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateCaseDocumentCommand(id, documentId, req.Status,
            req.FileUrl, req.ExpiryDate, req.Notes, req.ByName ?? User.Identity?.Name ?? ""), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/documents")]
    [RequirePermission("visa.cases.edit")]
    public async Task<IActionResult> AddDocument(Guid id, [FromBody] AddDocumentRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new AddCaseDocumentCommand(id, req.ApplicantId, req.Name,
            req.ByName ?? User.Identity?.Name ?? ""), ct);
        return OkOrError(result);
    }

    [HttpPost("{id:guid}/notes")]
    [RequirePermission("visa.cases.edit")]
    public async Task<IActionResult> AddNote(Guid id, [FromBody] AddNoteRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new AddCaseNoteCommand(id, req.Note, req.ByName ?? User.Identity?.Name ?? ""), ct);
        return NoContentOrError(result);
    }

    // Records the Finance invoice the frontend raised for this case's fees (orchestrated
    // client-side — Finance and Visa are separate services / schemas).
    [HttpPatch("{id:guid}/invoice")]
    [RequirePermission("visa.cases.edit")]
    public async Task<IActionResult> LinkInvoice(Guid id, [FromBody] LinkInvoiceRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new LinkCaseInvoiceCommand(id, req.InvoiceId, req.InvoiceNumber,
            req.ByName ?? User.Identity?.Name ?? ""), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("visa.cases.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteVisaCaseCommand(id), ct);
        return NoContentOrError(result);
    }

    public sealed record CreateVisaCaseRequest(Guid VisaTypeId, string? Emirate, string? CustomerName,
        Guid? CustomerId, string? Priority, string? AssignedTo, decimal? ServiceFee, decimal? GovtFee,
        string? SlaDueDate, string? Notes, IReadOnlyList<ApplicantInput> Applicants, string? CreatedByName);
    public sealed record ChangeStatusRequest(string Status, string? GovtReference, string? RejectionReason, string? VisaExpiryDate, string? Note, string? ByName);
    public sealed record AssignRequest(string AssignedTo, string? ByName);
    public sealed record UpdateDocumentRequest(string Status, string? FileUrl, string? ExpiryDate, string? Notes, string? ByName);
    public sealed record AddDocumentRequest(Guid? ApplicantId, string Name, string? ByName);
    public sealed record AddNoteRequest(string Note, string? ByName);
    public sealed record LinkInvoiceRequest(Guid InvoiceId, string? InvoiceNumber, string? ByName);
}
