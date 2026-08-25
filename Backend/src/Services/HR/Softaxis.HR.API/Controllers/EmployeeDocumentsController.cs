using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
// HR.API is a plain Microsoft.NET.Sdk project, so there is no implicit Microsoft.AspNetCore.Http
// using — IFormFile does not resolve without this (same trap as StatusCodes in RequirePermissionAttribute).
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Softaxis.HR.API.Authorization;
using Softaxis.HR.API.Controllers.Common;
using Softaxis.HR.Application.EmployeeDocuments;
using Softaxis.HR.Application.EmployeeDocuments.Commands;
using Softaxis.HR.Application.EmployeeDocuments.Queries;

namespace Softaxis.HR.API.Controllers;

/// <summary>
/// File attachments on an employee — passport and visa copies, contracts, certificates.
/// No dedicated documents permission key is seeded, so these gate on the nearest existing
/// employee keys.
/// </summary>
[ApiController]
[Route("api/hr/employees/{employeeId:guid}/documents")]
[Authorize]
public sealed class EmployeeDocumentsController(ISender sender) : HrControllerBase
{
    public sealed record UpdateDocumentRequest(string DocumentType, string? Description, string? ExpiryDate);

    /// <summary>Metadata for every document on the employee. Never returns file bytes.</summary>
    [HttpGet]
    [RequirePermission("hr.employees.view")]
    public async Task<IActionResult> GetAll(Guid employeeId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetEmployeeDocumentsQuery(employeeId), ct));

    [HttpPost]
    [RequirePermission("hr.employees.edit")]
    [RequestSizeLimit(UploadEmployeeDocumentValidator.MaxBytes + 1024 * 1024)]
    public async Task<IActionResult> Upload(
        Guid employeeId,
        IFormFile file,
        [FromForm] string? documentType,
        [FromForm] string? description,
        [FromForm] string? expiryDate,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { code = "Validation.Failed", description = "No file was uploaded." });

        if (DocumentFileRules.IsBlocked(file.FileName))
            return BadRequest(new { code = "Validation.Failed", description = DocumentFileRules.BlockedMessage(file.FileName) });

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);

        var result = await sender.Send(new UploadEmployeeDocumentCommand(
            employeeId,
            Path.GetFileName(file.FileName),
            string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType,
            ms.ToArray(),
            string.IsNullOrWhiteSpace(documentType) ? "other" : documentType,
            description,
            expiryDate,
            CurrentUserId(),
            User.Identity?.Name), ct);

        return OkOrError(result);
    }

    /// <summary>Streams the file back as a download.</summary>
    [HttpGet("{documentId:guid}/content")]
    [RequirePermission("hr.employees.view")]
    public async Task<IActionResult> Download(Guid employeeId, Guid documentId, CancellationToken ct)
    {
        var result = await sender.Send(new GetEmployeeDocumentContentQuery(employeeId, documentId), ct);
        if (!result.IsSuccess) return OkOrError(result);

        // File(...) sets Content-Disposition: attachment, so the browser saves rather than renders.
        return File(result.Value.Data, result.Value.ContentType, result.Value.FileName);
    }

    [HttpPut("{documentId:guid}")]
    [RequirePermission("hr.employees.edit")]
    public async Task<IActionResult> Update(
        Guid employeeId, Guid documentId, [FromBody] UpdateDocumentRequest req, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new UpdateEmployeeDocumentCommand(
            employeeId, documentId, req.DocumentType, req.Description, req.ExpiryDate), ct));

    [HttpDelete("{documentId:guid}")]
    [RequirePermission("hr.employees.delete")]
    public async Task<IActionResult> Delete(Guid employeeId, Guid documentId, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteEmployeeDocumentCommand(employeeId, documentId), ct));

    private Guid? CurrentUserId() =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id)
            ? id
            : null;
}
