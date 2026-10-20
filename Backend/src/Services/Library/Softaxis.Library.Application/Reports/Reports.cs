using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Library.Application.Reports;

/// <summary>A report as a table: column names, and rows keyed by column name.</summary>
public sealed record TabularReportDto(
    IReadOnlyList<string> Columns, IReadOnlyList<Dictionary<string, object?>> Rows, int TotalCount);

/// <summary>
/// One library report for the central Reports hub. <c>From</c> / <c>To</c> are calendar days
/// (yyyy-MM-dd) and default to the last 30 days; reports that describe "now" ignore them.
/// </summary>
public sealed record RunLibraryReportQuery(string ReportId, string? From, string? To, string? Today)
    : IQuery<TabularReportDto>;

// ── Fines collected → Finance ───────────────────────────────────────────────

public sealed record UnpostedPaymentDto(
    Guid Id, string PaidOn, string MemberName, string MemberNumber, string FineType, string? Title, string Method,
    decimal Amount);

public sealed record AmountByKeyDto(string Key, decimal Amount, int Count);

/// <summary>Fine payments taken up to a date that are not in the accounts yet.</summary>
public sealed record FinePostingPreviewDto(
    decimal Total, int Count, string? From, string? To, IReadOnlyList<AmountByKeyDto> ByMethod,
    IReadOnlyList<AmountByKeyDto> ByType, IReadOnlyList<UnpostedPaymentDto> Payments);

/// <param name="Through">Include payments taken on or before this day. Defaults to today.</param>
public sealed record GetUnpostedFinePaymentsQuery(string? Through, string? Today) : IQuery<FinePostingPreviewDto>;

public sealed record FinePostingResultDto(int Payments, decimal Amount, string? JournalEntryNumber);

/// <summary>
/// Records that these payments are in the given Finance journal entry. The entry itself is made
/// through Finance's own API by the caller — the library never writes into Finance.
/// </summary>
public sealed record MarkFinePaymentsPostedCommand(
    IReadOnlyList<Guid> PaymentIds, Guid JournalEntryId, string? JournalEntryNumber)
    : ICommand<FinePostingResultDto>;

public sealed record FinePostingHistoryDto(
    Guid JournalEntryId, string? JournalEntryNumber, DateTime PostedAt, decimal Amount, int Payments,
    string From, string To);

public sealed record GetFinePostingHistoryQuery : IQuery<IReadOnlyList<FinePostingHistoryDto>>;

public sealed class MarkFinePaymentsPostedValidator : AbstractValidator<MarkFinePaymentsPostedCommand>
{
    public MarkFinePaymentsPostedValidator()
    {
        RuleFor(x => x.PaymentIds).NotEmpty().WithMessage("There are no payments to post.");
        RuleFor(x => x.PaymentIds.Count).LessThanOrEqualTo(5000).WithMessage("Post at most 5,000 payments at a time.");
        RuleFor(x => x.JournalEntryId).NotEmpty();
        RuleFor(x => x.JournalEntryNumber).MaximumLength(60);
    }
}
