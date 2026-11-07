using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Finance.Application.EInvoicing;

// ── The provider seam ─────────────────────────────────────────────────────────────

public sealed record EInvoiceSendRequest(
    string DocumentType, Guid DocumentId, string DocumentNumber, string Environment,
    string IdempotencyKey, string Xml, EInvoiceDocument Document);

/// <param name="Outcome">One of <see cref="EInvoiceSendOutcome"/>. Must reflect what the provider actually said.</param>
/// <param name="Message">Already redacted; never contains credentials or tokens.</param>
public sealed record EInvoiceSendResult(string Outcome, string? ExternalId, string? Message);

public static class EInvoiceSendOutcome
{
    /// <summary>The provider accepted the document for delivery.</summary>
    public const string Sent = "sent";
    public const string Delivered = "delivered";
    public const string Accepted = "accepted";
    /// <summary>The provider refused the document itself. Sending it again unchanged cannot help.</summary>
    public const string Rejected = "rejected";
    /// <summary>Provider busy, network down, timeout. Safe to retry.</summary>
    public const string TransientFailure = "transient_failure";
    /// <summary>No provider is connected. Nothing was sent.</summary>
    public const string NotAvailable = "not_available";
}

/// <summary>
/// The single seam through which an e-invoice could leave Vrodux for an Accredited Service Provider.
/// One implementation per provider; the registered default sends nothing and says so, so the rest of
/// the system can be built, tested and shipped before any provider contract exists.
/// </summary>
public interface IEInvoiceGateway
{
    string ProviderKey { get; }
    /// <summary>False means <see cref="SendAsync"/> transmits nothing and the queue holds still.</summary>
    bool IsAvailable { get; }
    string? UnavailableReason { get; }
    Task<EInvoiceSendResult> SendAsync(EInvoiceSendRequest request, CancellationToken ct);
}

// ── DTOs ──────────────────────────────────────────────────────────────────────────

public sealed record EInvoiceSettingsDto(
    string ProviderKey, string Environment, bool Enabled, string? GoLiveDate,
    string? LegalIdScheme, string? LegalId, string? RegistrationAuthority, string? SupplierCity,
    bool ProviderAvailable, string? ProviderUnavailableReason, string SupplierTrn, string SupplierName);

public sealed record EInvoiceIssueDto(string Severity, string Code, string Message);

public sealed record EInvoiceCheckDto(
    string DocumentType, Guid DocumentId, string DocumentNumber, bool Ready, int Errors, int Warnings,
    IReadOnlyList<EInvoiceIssueDto> Issues);

public sealed record EInvoiceSubmissionDto(
    Guid Id, string DocumentType, Guid DocumentId, string DocumentNumber, string ProviderKey, string Status,
    int Attempts, DateTime? NextAttemptAt, string? ExternalId, string? LastError, bool HasXml,
    DateTime CreatedAt, DateTime? SentAt);

public sealed record EInvoiceSubmissionListDto(int Total, IReadOnlyList<EInvoiceSubmissionDto> Items);

public sealed record EInvoiceFileDto(string FileName, string ContentType, string Content);

public sealed record ReadinessProblemDto(string Kind, Guid? Id, string Name, string Problem);

public sealed record EInvoiceReadinessDto(
    int InvoicesChecked, int InvoicesReady, int InvoicesBlocked,
    int CustomersChecked, int CustomersMissingTrn, int CustomersMissingAddress, int CustomersMissingEmirate,
    bool SupplierReady, IReadOnlyList<EInvoiceIssueDto> SupplierIssues,
    IReadOnlyList<ReadinessProblemDto> Problems, IReadOnlyList<ReadinessTotalDto> Totals,
    int SubmissionsQueued, int SubmissionsFailed, int SubmissionsSent);

public sealed record ReadinessTotalDto(string Code, string Message, int Count);

public sealed record CreditNoteItemDto(
    Guid Id, string Description, decimal Quantity, decimal UnitPrice, decimal LineTotal,
    string? TaxCategory, string? UnitCode, string? ExemptionReason);

public sealed record CreditNoteDto(
    Guid Id, string CreditNoteNumber, Guid InvoiceId, string InvoiceNumber, string CustomerName,
    string? CustomerEmail, string? CustomerAddress, string? CustomerTrn, string CreditDate, decimal TaxRate,
    string CurrencyCode, string Reason, string? Notes, string Status, decimal SubTotal, decimal TaxAmount,
    decimal Total, Guid? JournalEntryId, DateTime CreatedAt, DateTime? IssuedAt, string? EInvoiceStatus,
    IReadOnlyList<CreditNoteItemDto> Items);

public sealed record CreditNoteSummaryDto(
    Guid Id, string CreditNoteNumber, Guid InvoiceId, string InvoiceNumber, string CustomerName,
    string CreditDate, string CurrencyCode, string Reason, string Status, decimal Total, string? EInvoiceStatus);

public sealed record CreditNoteItemRequest(
    string Description, decimal Quantity, decimal UnitPrice, string? TaxCategory, string? UnitCode, string? ExemptionReason);

// ── Settings ──────────────────────────────────────────────────────────────────────

public sealed record GetEInvoiceSettingsQuery : IQuery<EInvoiceSettingsDto>;

public sealed record UpdateEInvoiceSettingsCommand(
    string ProviderKey, string Environment, bool Enabled, string? GoLiveDate,
    string? LegalIdScheme, string? LegalId, string? RegistrationAuthority, string? SupplierCity) : ICommand<EInvoiceSettingsDto>;

public sealed class UpdateEInvoiceSettingsValidator : AbstractValidator<UpdateEInvoiceSettingsCommand>
{
    public UpdateEInvoiceSettingsValidator()
    {
        RuleFor(x => x.ProviderKey).MaximumLength(40);
        RuleFor(x => x.GoLiveDate).Matches(@"^\d{4}-\d{2}-\d{2}$").When(x => !string.IsNullOrWhiteSpace(x.GoLiveDate))
            .WithMessage("The go-live date must be yyyy-MM-dd.");
        RuleFor(x => x.LegalIdScheme)
            .Must(s => PintAeCodes.LegalIdSchemes.Contains(s!.Trim().ToUpperInvariant()))
            .When(x => !string.IsNullOrWhiteSpace(x.LegalIdScheme))
            .WithMessage("The legal registration type must be AE:TL, AE:EID, AE:PAS or AE:CD.");
        RuleFor(x => x.LegalId).MaximumLength(60);
        RuleFor(x => x.RegistrationAuthority).MaximumLength(120);
        RuleFor(x => x.SupplierCity).MaximumLength(100);
    }
}

// ── Documents ─────────────────────────────────────────────────────────────────────

/// <param name="DocumentType">invoice | credit_note</param>
public sealed record CheckEInvoiceQuery(string DocumentType, Guid DocumentId) : IQuery<EInvoiceCheckDto>;

public sealed record GetEInvoiceXmlQuery(string DocumentType, Guid DocumentId) : IQuery<EInvoiceFileDto>;

public sealed record QueueEInvoiceCommand(string DocumentType, Guid DocumentId) : ICommand<EInvoiceSubmissionDto>;

public sealed record GetEInvoiceSubmissionsQuery(string? Status, string? DocumentType, Guid? DocumentId, int Page = 1, int PageSize = 50)
    : IQuery<EInvoiceSubmissionListDto>;

public sealed record RetryEInvoiceSubmissionCommand(Guid Id) : ICommand<EInvoiceSubmissionDto>;

public sealed record GetEInvoiceReadinessQuery : IQuery<EInvoiceReadinessDto>;

// ── Credit notes ──────────────────────────────────────────────────────────────────

/// <param name="Items">Null or empty credits the whole invoice, line for line.</param>
public sealed record CreateCreditNoteCommand(
    Guid InvoiceId, string Reason, string? CreditDate, string? Notes,
    IReadOnlyList<CreditNoteItemRequest>? Items) : ICommand<CreditNoteDto>;

public sealed class CreateCreditNoteValidator : AbstractValidator<CreateCreditNoteCommand>
{
    public CreateCreditNoteValidator()
    {
        RuleFor(x => x.Reason).NotEmpty().WithMessage("Say why the invoice is being credited.").MaximumLength(500);
        RuleFor(x => x.Notes).MaximumLength(1000);
        RuleFor(x => x.CreditDate).Matches(@"^\d{4}-\d{2}-\d{2}$").When(x => !string.IsNullOrWhiteSpace(x.CreditDate));
        RuleForEach(x => x.Items).ChildRules(i =>
        {
            i.RuleFor(l => l.Description).NotEmpty().MaximumLength(300);
            i.RuleFor(l => l.Quantity).GreaterThan(0).WithMessage("A credit note line needs a quantity above zero.");
            i.RuleFor(l => l.UnitPrice).GreaterThanOrEqualTo(0);
            i.RuleFor(l => l.TaxCategory)
                .Must(c => Softaxis.Finance.Domain.Entities.VatCategory.All.Contains(c!.Trim().ToUpperInvariant()))
                .When(l => !string.IsNullOrWhiteSpace(l.TaxCategory))
                .WithMessage("Tax category must be S, Z, E or O.");
        });
    }
}

public sealed record IssueCreditNoteCommand(Guid Id) : ICommand<CreditNoteDto>;
public sealed record CancelCreditNoteCommand(Guid Id) : ICommand;
public sealed record GetCreditNotesQuery(Guid? InvoiceId, string? Status) : IQuery<IReadOnlyList<CreditNoteSummaryDto>>;
public sealed record GetCreditNoteByIdQuery(Guid Id) : IQuery<CreditNoteDto>;
