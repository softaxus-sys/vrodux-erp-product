using System.Text;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.EInvoicing;

namespace Softaxis.Finance.API.Controllers;

/// <summary>
/// UAE e-invoicing: readiness, the send queue, the provider settings, the PINT AE XML, and credit notes.
/// Nothing here transmits on its own — documents leave only through a connected provider's gateway.
/// </summary>
[ApiController]
[Route("api/finance/einvoicing")]
[Authorize]
public sealed class EInvoicingController(ISender sender) : FinanceControllerBase
{
    [HttpGet("settings")]
    [RequirePermission("finance.einvoicing.view")]
    public async Task<IActionResult> GetSettings(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetEInvoiceSettingsQuery(), ct));

    [HttpPut("settings")]
    [RequirePermission("finance.einvoicing.edit")]
    public async Task<IActionResult> UpdateSettings([FromBody] UpdateEInvoiceSettingsCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpGet("readiness")]
    [RequirePermission("finance.einvoicing.view")]
    public async Task<IActionResult> Readiness(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetEInvoiceReadinessQuery(), ct));

    [HttpGet("{documentType}/{documentId:guid}/check")]
    [RequirePermission("finance.einvoicing.view")]
    public async Task<IActionResult> Check(string documentType, Guid documentId, CancellationToken ct) =>
        OkOrError(await sender.Send(new CheckEInvoiceQuery(Normalise(documentType), documentId), ct));

    [HttpGet("{documentType}/{documentId:guid}/xml")]
    [RequirePermission("finance.einvoicing.view")]
    public async Task<IActionResult> Xml(string documentType, Guid documentId, CancellationToken ct)
    {
        var result = await sender.Send(new GetEInvoiceXmlQuery(Normalise(documentType), documentId), ct);
        if (result.IsFailure) return OkOrError(result);
        return File(Encoding.UTF8.GetBytes(result.Value.Content), result.Value.ContentType, result.Value.FileName);
    }

    [HttpPost("{documentType}/{documentId:guid}/queue")]
    [RequirePermission("finance.einvoicing.send")]
    public async Task<IActionResult> Queue(string documentType, Guid documentId, CancellationToken ct) =>
        OkOrError(await sender.Send(new QueueEInvoiceCommand(Normalise(documentType), documentId), ct));

    [HttpGet("submissions")]
    [RequirePermission("finance.einvoicing.view")]
    public async Task<IActionResult> Submissions([FromQuery] string? status, [FromQuery] string? documentType,
        [FromQuery] Guid? documentId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetEInvoiceSubmissionsQuery(status,
            string.IsNullOrWhiteSpace(documentType) ? null : Normalise(documentType), documentId, page, pageSize), ct));

    [HttpPost("submissions/{id:guid}/retry")]
    [RequirePermission("finance.einvoicing.send")]
    public async Task<IActionResult> Retry(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new RetryEInvoiceSubmissionCommand(id), ct));

    // ── Credit notes ────────────────────────────────────────────────────────────

    [HttpGet("credit-notes")]
    [RequirePermission("finance.invoicing.view")]
    public async Task<IActionResult> CreditNotes([FromQuery] Guid? invoiceId, [FromQuery] string? status, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetCreditNotesQuery(invoiceId, status), ct));

    [HttpGet("credit-notes/{id:guid}")]
    [RequirePermission("finance.invoicing.view")]
    public async Task<IActionResult> CreditNote(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetCreditNoteByIdQuery(id), ct));

    [HttpPost("credit-notes")]
    [RequirePermission("finance.invoicing.create")]
    public async Task<IActionResult> CreateCreditNote([FromBody] CreateCreditNoteCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpPost("credit-notes/{id:guid}/issue")]
    [RequirePermission("finance.invoicing.edit")]
    public async Task<IActionResult> IssueCreditNote(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new IssueCreditNoteCommand(id), ct));

    [HttpDelete("credit-notes/{id:guid}")]
    [RequirePermission("finance.invoicing.edit")]
    public async Task<IActionResult> CancelCreditNote(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new CancelCreditNoteCommand(id), ct));

    /// <summary>Routes use "credit-note"; the stored value is "credit_note".</summary>
    private static string Normalise(string t) => t.Trim().ToLowerInvariant().Replace('-', '_');
}
