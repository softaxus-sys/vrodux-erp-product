using MediatR;
using Microsoft.AspNetCore.Authorization;
// CRM.API is a plain Microsoft.NET.Sdk project, so there is no implicit Microsoft.AspNetCore.Http
// using — IFormFile does not resolve without this (same trap as StatusCodes in RequirePermissionAttribute).
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Authorization;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Documents.Commands;
using Softaxis.CRM.Application.Documents.Queries;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// Document attachments for CRM records — contracts, proposals, signed agreements, ID copies.
///
/// Works for a lead, an opportunity, an account or a contact via <c>relatedToType</c>, so documents
/// are available at every stage of the funnel. Like activities there is no dedicated
/// <c>crm.documents</c> permission group seeded, so these gate on the nearest existing key
/// (<c>crm.leads</c>, plus the assigned-only tier); the handlers then enforce per-record access.
/// </summary>
[ApiController][Route("api/crm/documents")][Authorize]
public sealed class CrmDocumentsController(ISender sender) : CrmControllerBase
{
    /// <summary>Metadata for every document on a record. Never returns file bytes.</summary>
    [HttpGet]
    [RequireAnyPermission(
        "crm.leads.view",     "crm.leads-team.view",     "crm.leads-assigned.view",
        "crm.pipeline.view",  "crm.pipeline-team.view",  "crm.pipeline-assigned.view",
        "crm.customers.view", "crm.customers-team.view", "crm.customers-assigned.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string relatedToType, [FromQuery] Guid relatedToId, CancellationToken ct)
    {
        var result = await sender.Send(new GetCrmDocumentsQuery(relatedToType, relatedToId), ct);
        return OkOrError(result);
    }

    /// <summary>Tenant-wide document library — search/filter across every CRM record.</summary>
    [HttpGet("library")]
    [RequireAnyPermission(
        "crm.leads.view",     "crm.leads-team.view",     "crm.leads-assigned.view",
        "crm.pipeline.view",  "crm.pipeline-team.view",  "crm.pipeline-assigned.view",
        "crm.customers.view", "crm.customers-team.view", "crm.customers-assigned.view")]
    public async Task<IActionResult> Library(
        [FromQuery] string? search, [FromQuery] string? documentType,
        [FromQuery] string? relatedToType, CancellationToken ct)
    {
        var result = await sender.Send(new SearchCrmDocumentsQuery(search, documentType, relatedToType), ct);
        return OkOrError(result);
    }

    [HttpPost]
    [RequestSizeLimit(UploadCrmDocumentCommandValidator.MaxBytes + 1024 * 1024)]
    [RequireAnyPermission(
        "crm.leads.edit",     "crm.leads-team.edit",     "crm.leads-assigned.edit",
        "crm.pipeline.edit",  "crm.pipeline-team.edit",  "crm.pipeline-assigned.edit",
        "crm.customers.edit", "crm.customers-team.edit", "crm.customers-assigned.edit")]
    public async Task<IActionResult> Upload([FromForm] UploadDocumentForm form, CancellationToken ct)
    {
        if (form.File is null || form.File.Length == 0)
            return BadRequest(new { error = "No file uploaded." });

        using var ms = new MemoryStream();
        await form.File.CopyToAsync(ms, ct);

        var result = await sender.Send(new UploadCrmDocumentCommand(
            form.RelatedToType ?? "",
            form.RelatedToId,
            ms.ToArray(),
            form.File.FileName,
            form.File.ContentType ?? "application/octet-stream",
            string.IsNullOrWhiteSpace(form.DocumentType) ? "other" : form.DocumentType,
            form.Description), ct);

        return OkOrError(result);
    }

    /// <summary>Streams the file back for download / preview.</summary>
    [HttpGet("{id:guid}/content")]
    [RequireAnyPermission(
        "crm.leads.view",     "crm.leads-team.view",     "crm.leads-assigned.view",
        "crm.pipeline.view",  "crm.pipeline-team.view",  "crm.pipeline-assigned.view",
        "crm.customers.view", "crm.customers-team.view", "crm.customers-assigned.view")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetCrmDocumentContentQuery(id), ct);
        if (!result.IsSuccess)
            return OkOrError(result);

        var doc = result.Value;
        return File(doc.Data, doc.ContentType, doc.FileName);
    }

    /// <summary>Re-categorise or re-describe a document. File content is immutable — upload again to replace it.</summary>
    [HttpPut("{id:guid}")]
    [RequireAnyPermission(
        "crm.leads.edit",     "crm.leads-team.edit",     "crm.leads-assigned.edit",
        "crm.pipeline.edit",  "crm.pipeline-team.edit",  "crm.pipeline-assigned.edit",
        "crm.customers.edit", "crm.customers-team.edit", "crm.customers-assigned.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateDocumentRequest body, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateCrmDocumentCommand(id, body.DocumentType, body.Description), ct);
        return OkOrError(result);
    }

    [HttpDelete("{id:guid}")]
    [RequireAnyPermission(
        "crm.leads.edit",     "crm.leads-team.edit",     "crm.leads-assigned.edit",
        "crm.pipeline.edit",  "crm.pipeline-team.edit",  "crm.pipeline-assigned.edit",
        "crm.customers.edit", "crm.customers-team.edit", "crm.customers-assigned.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteCrmDocumentCommand(id), ct);
        return NoContentOrError(result);
    }

    /// <summary>Multipart form shape — the file plus which record it belongs to.</summary>
    public sealed class UploadDocumentForm
    {
        public string?     RelatedToType { get; set; }
        public Guid        RelatedToId   { get; set; }
        public string?     DocumentType  { get; set; }
        public string?     Description   { get; set; }
        public IFormFile?  File          { get; set; }
    }

    public sealed record UpdateDocumentRequest(string DocumentType, string? Description);
}
