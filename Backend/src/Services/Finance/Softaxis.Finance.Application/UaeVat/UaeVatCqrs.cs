using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Finance.Application.UaeVat;

// ── DTOs ──────────────────────────────────────────────────────────────────────────

public sealed record UaeVatProfileDto(
    bool    Configured, string Trn, string NameEn, string? NameAr, string? Address, string DefaultEmirate,
    string? TaxAgencyName, string? Tan, string? TaxAgentName, string? Taan);

public sealed record UaeVatIntegrationDto(
    string Environment, bool SubmissionAvailable, string? UnavailableReason);

public sealed record VatReturnAttemptDto(
    Guid Id, int AttemptNumber, string Environment, string Outcome, int? HttpStatus,
    string? ExternalReference, string? Message, string? StartedByName, DateTime StartedAt, DateTime? CompletedAt);

public sealed record VatReturnDto(
    Guid    Id, Guid TaxPeriodId, string PeriodLabel, string FromDate, string ToDate, string Status,
    string  Trn, decimal OutputVat, decimal InputVat, decimal NetVat,
    IReadOnlyList<VatBox> Boxes, IReadOnlyList<VatReturnIssue> Issues, VatReconciliation? Reconciliation,
    bool    HasBlockingErrors, bool IsReconciled,
    string? PreparedByName, DateTime? PreparedAt, string? ApprovedByName, DateTime? ApprovedAt,
    string? Environment, string? SubmissionReference, DateTime? SubmittedAt, DateTime? AcknowledgedAt,
    string? RejectionReason, string? FiledByName, string? ContentHash, bool HasFiles,
    IReadOnlyList<VatReturnAttemptDto> Attempts);

public sealed record VatReturnFileDto(string FileName, string ContentType, string Content);

// ── Commands ──────────────────────────────────────────────────────────────────────

public sealed record UpsertUaeVatProfileCommand(
    string Trn, string NameEn, string? NameAr, string? Address, string DefaultEmirate,
    string? TaxAgencyName, string? Tan, string? TaxAgentName, string? Taan) : ICommand<UaeVatProfileDto>;

public sealed class UpsertUaeVatProfileValidator : AbstractValidator<UpsertUaeVatProfileCommand>
{
    public UpsertUaeVatProfileValidator()
    {
        RuleFor(x => x.Trn).Must(t => UaeVatReturnBuilder.IsValidTrn(new string((t ?? "").Where(char.IsDigit).ToArray())))
            .WithMessage("TRN must be 15 digits starting with 100.");
        RuleFor(x => x.NameEn).NotEmpty().MaximumLength(100).WithMessage("Taxable person name (English) is required.");
        RuleFor(x => x.NameAr).MaximumLength(100);
        RuleFor(x => x.Address).MaximumLength(500);
        RuleFor(x => x.DefaultEmirate).Must(e => UaeVatReturnBuilder.Emirates.ContainsKey((e ?? "").ToUpperInvariant()))
            .WithMessage("Choose a valid emirate.");
        RuleFor(x => x.Tan).MaximumLength(20);
        RuleFor(x => x.Taan).MaximumLength(20);
    }
}

/// <summary>Builds (or rebuilds) the return for a tax period from the ledger, validates and reconciles it.</summary>
public sealed record PrepareVatReturnCommand(Guid TaxPeriodId, string? ActorName = null) : ICommand<VatReturnDto>;

public sealed record ApproveVatReturnCommand(Guid Id, string? ActorId = null, string? ActorName = null) : ICommand<VatReturnDto>;

public sealed record MarkVatReturnReadyCommand(Guid Id) : ICommand<VatReturnDto>;

public sealed record SubmitVatReturnCommand(Guid Id, string? ActorName = null) : ICommand<VatReturnDto>;

public sealed record RecordVatPortalFilingCommand(Guid Id, string Reference, string? ActorName = null) : ICommand<VatReturnDto>;

// ── Queries ───────────────────────────────────────────────────────────────────────

public sealed record GetUaeVatProfileQuery : IQuery<UaeVatProfileDto>;
public sealed record GetUaeVatIntegrationQuery : IQuery<UaeVatIntegrationDto>;
public sealed record GetVatReturnsQuery(Guid? TaxPeriodId = null) : IQuery<IReadOnlyList<VatReturnDto>>;
public sealed record GetVatReturnByIdQuery(Guid Id) : IQuery<VatReturnDto>;
/// <param name="Kind">faf | xml | attempts</param>
public sealed record GetVatReturnFileQuery(Guid Id, string Kind) : IQuery<VatReturnFileDto>;
