using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Sales.Application.Quotations.Dtos;

namespace Softaxis.Sales.Application.Quotations.Commands;

// ── Shared line/section shapes ────────────────────────────────────────────────

/// <summary>
/// A section as submitted by the builder. <paramref name="ClientId"/> is the id the browser
/// used to tie its lines to this section before either existed server-side; the handler maps it
/// to the real section id. Without it, a create with sections would need two round-trips.
/// </summary>
public sealed record QuotationSectionRequest(
    string  ClientId,
    string  Title,
    string? Description,
    int     SortOrder);

public sealed record QuotationItemRequest(
    Guid?   ProductId,
    string  Description,
    string? Unit,
    string? Notes,
    decimal Quantity,
    decimal UnitPrice,
    decimal DiscountPercent,
    decimal TaxRate,
    string? SectionClientId,
    bool    IsOptional,
    int     SortOrder);

/// <summary>Document-level fields shared by create and update.</summary>
public sealed record QuotationDocumentRequest(
    string? Title,
    string? Reference,
    string? IssueDate,
    string? CoverNote,
    string? TermsAndConditions,
    string? PaymentTerms,
    string? PreparedByName,
    string? CustomerEmail,
    string? CustomerPhone,
    string? CustomerAddress,
    Dictionary<string, string>? CustomFields);

// ── Commands ──────────────────────────────────────────────────────────────────

public sealed record CreateQuotationCommand(
    Guid?   CustomerId,
    string? CustomerName,
    string? Notes,
    string? ValidUntil,
    decimal DiscountPercent,
    IReadOnlyList<QuotationItemRequest>    Items,
    IReadOnlyList<QuotationSectionRequest>? Sections = null,
    QuotationDocumentRequest?               Document = null,
    Guid?                                   TemplateId = null
) : ICommand<QuotationDto>;

public sealed record UpdateQuotationCommand(
    Guid    Id,
    Guid?   CustomerId,
    string? CustomerName,
    string? Notes,
    string? ValidUntil,
    decimal DiscountPercent,
    string  Status,
    IReadOnlyList<QuotationItemRequest>     Items,
    IReadOnlyList<QuotationSectionRequest>? Sections = null,
    QuotationDocumentRequest?               Document = null
) : ICommand<QuotationDto>;

public sealed record DeleteQuotationCommand(Guid Id) : ICommand;

/// <summary>Creates the share link if needed and (optionally) emails it to the customer.</summary>
public sealed record SendQuotationCommand(Guid Id, string? ToEmail, string? Message, bool SendEmail = true)
    : ICommand<QuotationSendResultDto>;

/// <summary>Issues a share link without sending anything — the "copy link" flow.</summary>
public sealed record CreateQuotationShareLinkCommand(Guid Id) : ICommand<QuotationShareLinkDto>;

public sealed record RevokeQuotationShareLinkCommand(Guid Id) : ICommand;

/// <summary>Records a decision taken inside the app (phone call, meeting) rather than via the link.</summary>
public sealed record RespondToQuotationCommand(Guid Id, bool Accepted, string? ByName, string? Comment)
    : ICommand<QuotationDto>;

public sealed record ConvertQuotationToOrderCommand(Guid Id) : ICommand<ConvertQuotationResultDto>;

/// <summary>
/// Attaches the quotation to a Finance invoice — used both after generating an invoice from it
/// and when linking one that already exists. Passing a null invoice id unlinks.
/// </summary>
public sealed record LinkQuotationInvoiceCommand(Guid Id, Guid? InvoiceId, string? InvoiceNumber)
    : ICommand<QuotationDto>;

/// <summary>Copies an existing quotation into a fresh draft (revise / re-quote).</summary>
public sealed record DuplicateQuotationCommand(Guid Id) : ICommand<QuotationDto>;

// ── Public (anonymous, token-addressed) ───────────────────────────────────────

public sealed record ViewPublicQuotationCommand(string Token) : ICommand<PublicQuotationDto>;

public sealed record RespondToPublicQuotationCommand(string Token, bool Accepted, string? ByName, string? Comment)
    : ICommand<PublicQuotationDto>;

// ── Validators ────────────────────────────────────────────────────────────────
// Shared as child validators rather than generic helpers: FluentValidation's RuleFor needs an
// Expression, not a Func, so a "pass the accessor in" helper cannot compile.

public sealed class QuotationItemRequestValidator : AbstractValidator<QuotationItemRequest>
{
    public QuotationItemRequestValidator()
    {
        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Item description is required.")
            .MaximumLength(300).WithMessage("Item description must be ≤ 300 characters.");
        RuleFor(x => x.Quantity).GreaterThan(0).WithMessage("Quantity must be greater than 0.");
        RuleFor(x => x.UnitPrice).GreaterThanOrEqualTo(0).WithMessage("Unit price cannot be negative.");
        RuleFor(x => x.DiscountPercent).InclusiveBetween(0, 100)
            .WithMessage("Line discount must be between 0 and 100.");
        RuleFor(x => x.TaxRate).InclusiveBetween(0, 100)
            .WithMessage("Tax rate must be between 0 and 100.");
        RuleFor(x => x.Unit).MaximumLength(30).When(x => x.Unit is not null);
        RuleFor(x => x.Notes).MaximumLength(500).When(x => x.Notes is not null);
    }
}

public sealed class QuotationSectionRequestValidator : AbstractValidator<QuotationSectionRequest>
{
    public QuotationSectionRequestValidator()
    {
        RuleFor(x => x.Title).NotEmpty().WithMessage("Section title is required.").MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(1000).When(x => x.Description is not null);
    }
}

public sealed class QuotationDocumentRequestValidator : AbstractValidator<QuotationDocumentRequest>
{
    public QuotationDocumentRequestValidator()
    {
        RuleFor(x => x.Title).MaximumLength(200);
        RuleFor(x => x.Reference).MaximumLength(100);
        RuleFor(x => x.CoverNote).MaximumLength(4000);
        RuleFor(x => x.TermsAndConditions).MaximumLength(8000);
        RuleFor(x => x.PaymentTerms).MaximumLength(1000);
        RuleFor(x => x.PreparedByName).MaximumLength(200);
        RuleFor(x => x.CustomerAddress).MaximumLength(500);
        RuleFor(x => x.CustomerPhone).MaximumLength(50);
        RuleFor(x => x.CustomerEmail)
            .EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.CustomerEmail))
            .WithMessage("Customer email is not a valid address.");
        // A document is a page, not a database: a hundred bespoke rows is a sign something has
        // gone wrong, and it would blow past the JSON column budget.
        RuleFor(x => x.CustomFields)
            .Must(f => f is null || f.Count <= 25)
            .WithMessage("A quotation can carry at most 25 custom fields.");
    }
}

public sealed class CreateQuotationValidator : AbstractValidator<CreateQuotationCommand>
{
    public CreateQuotationValidator()
    {
        RuleFor(x => x.DiscountPercent).InclusiveBetween(0, 100)
            .WithMessage("Discount must be between 0 and 100.");
        RuleFor(x => x.Notes).MaximumLength(1000).When(x => x.Notes is not null);
        RuleFor(x => x.Items).NotEmpty().WithMessage("At least one line item is required.");
        RuleForEach(x => x.Items).SetValidator(new QuotationItemRequestValidator());
        RuleForEach(x => x.Sections!).SetValidator(new QuotationSectionRequestValidator())
            .When(x => x.Sections is not null);
        RuleFor(x => x.Document!).SetValidator(new QuotationDocumentRequestValidator())
            .When(x => x.Document is not null);
    }
}

public sealed class UpdateQuotationValidator : AbstractValidator<UpdateQuotationCommand>
{
    public UpdateQuotationValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Status).NotEmpty().MaximumLength(30);
        RuleFor(x => x.DiscountPercent).InclusiveBetween(0, 100)
            .WithMessage("Discount must be between 0 and 100.");
        RuleFor(x => x.Notes).MaximumLength(1000).When(x => x.Notes is not null);
        RuleFor(x => x.Items).NotEmpty().WithMessage("At least one line item is required.");
        RuleForEach(x => x.Items).SetValidator(new QuotationItemRequestValidator());
        RuleForEach(x => x.Sections!).SetValidator(new QuotationSectionRequestValidator())
            .When(x => x.Sections is not null);
        RuleFor(x => x.Document!).SetValidator(new QuotationDocumentRequestValidator())
            .When(x => x.Document is not null);
    }
}

public sealed class SendQuotationValidator : AbstractValidator<SendQuotationCommand>
{
    public SendQuotationValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.ToEmail)
            .EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.ToEmail))
            .WithMessage("Recipient email is not a valid address.");
        RuleFor(x => x.Message).MaximumLength(2000).When(x => x.Message is not null);
    }
}

public sealed class RespondToQuotationValidator : AbstractValidator<RespondToQuotationCommand>
{
    public RespondToQuotationValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.ByName).MaximumLength(200).When(x => x.ByName is not null);
        RuleFor(x => x.Comment).MaximumLength(2000).When(x => x.Comment is not null);
    }
}

public sealed class RespondToPublicQuotationValidator : AbstractValidator<RespondToPublicQuotationCommand>
{
    public RespondToPublicQuotationValidator()
    {
        RuleFor(x => x.Token).NotEmpty().MaximumLength(64);
        RuleFor(x => x.ByName).MaximumLength(200).When(x => x.ByName is not null);
        RuleFor(x => x.Comment).MaximumLength(2000).When(x => x.Comment is not null);
    }
}
