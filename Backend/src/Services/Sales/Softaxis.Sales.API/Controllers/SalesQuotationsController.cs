using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Sales.API.Authorization;
using Softaxis.Sales.API.Controllers.Common;
using Softaxis.Sales.Application.Quotations.Commands;
using Softaxis.Sales.Application.Quotations.Queries;

namespace Softaxis.Sales.API.Controllers;

/// <summary>
/// Quotations / proposals.
///
/// Migrated from the DbContext-injecting, inline-DTO shape flagged as tech debt in Module 5o to
/// the mandatory CQRS layering, as part of turning this from an items-and-total record into a
/// full customer-facing document. Request records stay inline (route + body shapes only), the
/// same exception Finance's AccountsController uses.
/// </summary>
[ApiController]
[Route("api/sales/quotations")]
[Authorize]
public sealed class SalesQuotationsController(ISender sender) : SalesControllerBase
{
    // ── Reads ────────────────────────────────────────────────────────────────
    [HttpGet]
    [RequirePermission("sales.quotations.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page       = 1,
        [FromQuery] int     pageSize   = 20,
        [FromQuery] string? search     = null,
        [FromQuery] string? status     = null,
        [FromQuery] Guid?   customerId = null,
        [FromQuery] Guid?   invoiceId  = null,
        CancellationToken ct = default)
        => OkOrError(await sender.Send(
            new GetQuotationsQuery(page, pageSize, search, status, customerId, invoiceId), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("sales.quotations.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => OkOrError(await sender.Send(new GetQuotationByIdQuery(id), ct));

    // ── Writes ───────────────────────────────────────────────────────────────
    [HttpPost]
    [RequirePermission("sales.quotations.create")]
    public async Task<IActionResult> Create([FromBody] CreateQuotationCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return result.IsSuccess
            ? CreatedOrError(result, nameof(GetById), new { id = result.Value.Id })
            : OkOrError(result);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("sales.quotations.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateQuotationBody body, CancellationToken ct)
        => OkOrError(await sender.Send(new UpdateQuotationCommand(
            id, body.CustomerId, body.CustomerName, body.Notes, body.ValidUntil,
            body.DiscountPercent, body.Status, body.Items, body.Sections, body.Document), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("sales.quotations.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => NoContentOrError(await sender.Send(new DeleteQuotationCommand(id), ct));

    /// <summary>Copies a quotation into a fresh draft — the revise / re-quote flow.</summary>
    [HttpPost("{id:guid}/duplicate")]
    [RequirePermission("sales.quotations.create")]
    public async Task<IActionResult> Duplicate(Guid id, CancellationToken ct)
        => OkOrError(await sender.Send(new DuplicateQuotationCommand(id), ct));

    // ── Sharing ──────────────────────────────────────────────────────────────
    [HttpPost("{id:guid}/send")]
    [RequirePermission("sales.quotations.edit")]
    public async Task<IActionResult> Send(Guid id, [FromBody] SendQuotationBody? body, CancellationToken ct)
        => OkOrError(await sender.Send(
            new SendQuotationCommand(id, body?.ToEmail, body?.Message, body?.SendEmail ?? true), ct));

    [HttpPost("{id:guid}/share-link")]
    [RequirePermission("sales.quotations.edit")]
    public async Task<IActionResult> CreateShareLink(Guid id, CancellationToken ct)
        => OkOrError(await sender.Send(new CreateQuotationShareLinkCommand(id), ct));

    [HttpDelete("{id:guid}/share-link")]
    [RequirePermission("sales.quotations.edit")]
    public async Task<IActionResult> RevokeShareLink(Guid id, CancellationToken ct)
        => NoContentOrError(await sender.Send(new RevokeQuotationShareLinkCommand(id), ct));

    /// <summary>Records a decision the customer gave off-platform (phone, meeting, reply).</summary>
    [HttpPost("{id:guid}/respond")]
    [RequirePermission("sales.quotations.edit")]
    public async Task<IActionResult> Respond(Guid id, [FromBody] RespondBody body, CancellationToken ct)
        => OkOrError(await sender.Send(
            new RespondToQuotationCommand(id, body.Accepted, body.ByName, body.Comment), ct));

    // ── Downstream ───────────────────────────────────────────────────────────
    // Convert spawns a sales order from the quotation — gate on quotation edit.
    [HttpPost("{id:guid}/convert")]
    [RequirePermission("sales.quotations.edit")]
    public async Task<IActionResult> ConvertToOrder(Guid id, CancellationToken ct)
        => OkOrError(await sender.Send(new ConvertQuotationToOrderCommand(id), ct));

    /// <summary>
    /// Attaches the quotation to a Finance invoice. Sales must never write into Finance's
    /// schema, so the invoice itself is created by the caller against the Finance API and only
    /// its id and number are recorded here — the same orchestration the visa module uses to
    /// raise an invoice for a case.
    /// </summary>
    [HttpPatch("{id:guid}/invoice")]
    [RequirePermission("sales.quotations.edit")]
    public async Task<IActionResult> LinkInvoice(Guid id, [FromBody] LinkInvoiceBody body, CancellationToken ct)
        => OkOrError(await sender.Send(
            new LinkQuotationInvoiceCommand(id, body.InvoiceId, body.InvoiceNumber), ct));

    // ── Request bodies (route + body shapes only) ────────────────────────────
    public sealed record UpdateQuotationBody(
        Guid?   CustomerId,
        string? CustomerName,
        string? Notes,
        string? ValidUntil,
        decimal DiscountPercent,
        string  Status,
        IReadOnlyList<QuotationItemRequest>     Items,
        IReadOnlyList<QuotationSectionRequest>? Sections,
        QuotationDocumentRequest?               Document);

    public sealed record SendQuotationBody(string? ToEmail, string? Message, bool? SendEmail);
    public sealed record RespondBody(bool Accepted, string? ByName, string? Comment);
    public sealed record LinkInvoiceBody(Guid? InvoiceId, string? InvoiceNumber);
}
