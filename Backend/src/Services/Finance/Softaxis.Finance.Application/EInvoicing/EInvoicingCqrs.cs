using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Finance.Application.EInvoicing;

// ── Gateway (implemented in Infrastructure) ─────────────────────────────────────────────────

/// <param name="Outcome">accepted | rejected | failed | not_configured.</param>
public sealed record EInvoiceSendResult(
    string  Outcome,
    int?    HttpStatus,
    string? ProviderMessageId,
    string? Message);

/// <summary>
/// Delivers a PINT AE document to the workspace's Accredited Service Provider. Only an ASP can
/// put an invoice on the UAE network, so this is the single seam every send goes through.
/// </summary>
public interface IEInvoiceGateway
{
    /// <summary>Whether an ASP is configured — when false, <see cref="SendAsync"/> never sends.</summary>
    bool    IsConfigured { get; }
    string  ProviderName { get; }
    /// <summary>"sandbox" or "production".</summary>
    string  Environment  { get; }

    /// <param name="idempotencyKey">Sent so a retried request is recognised as the same document.</param>
    Task<EInvoiceSendResult> SendAsync(string invoiceNumber, string xml, string idempotencyKey, CancellationToken ct);
}

// ── DTOs ────────────────────────────────────────────────────────────────────────────────────

public sealed record EInvoiceSubmissionDto(
    Guid      Id,
    string    Status,
    string    Provider,
    string    Environment,
    string?   ProviderMessageId,
    int?      HttpStatus,
    string?   Message,
    string?   SubmittedByName,
    DateTime  CreatedAt,
    DateTime? CompletedAt);

public sealed record EInvoiceStatusDto(
    Guid    InvoiceId,
    string  InvoiceNumber,
    bool    GatewayConfigured,
    string  Provider,
    string  Environment,
    /// <summary>The XML as it would be sent now. Null when the invoice data could not be read.</summary>
    string? Xml,
    IReadOnlyList<PintAeIssue> Issues,
    bool    CanSubmit,
    IReadOnlyList<EInvoiceSubmissionDto> Submissions);

// ── Queries / commands ──────────────────────────────────────────────────────────────────────

/// <summary>Builds the invoice's PINT AE XML and checks it. Sends nothing.</summary>
public sealed record GetEInvoiceStatusQuery(Guid InvoiceId) : IQuery<EInvoiceStatusDto>;

/// <summary>Sends the invoice to the ASP. Refused while the document has errors, or already sent.</summary>
public sealed record SubmitEInvoiceCommand(Guid InvoiceId, string? UserId, string? UserName)
    : ICommand<EInvoiceSubmissionDto>;

public sealed class SubmitEInvoiceCommandValidator : AbstractValidator<SubmitEInvoiceCommand>
{
    public SubmitEInvoiceCommandValidator() => RuleFor(x => x.InvoiceId).NotEmpty();
}
