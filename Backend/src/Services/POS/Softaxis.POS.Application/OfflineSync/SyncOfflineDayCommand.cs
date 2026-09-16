using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Application.Transactions.Commands.CreateSale;

namespace Softaxis.POS.Application.OfflineSync;

/// <summary>
/// Uploads everything an offline till recorded — one or more shifts, each with its events in the
/// order they happened. Safe to send more than once: every record carries a ClientRef and anything
/// already on the server is reported as a duplicate instead of being applied again.
/// </summary>
public sealed record SyncOfflineDayCommand(
    Guid                                BatchId,
    string                              RegisterId,
    IReadOnlyList<OfflineSessionPayload> Sessions,
    bool                                ForceClose = false) : ICommand<OfflineSyncResultDto>;

public sealed record OfflineSessionPayload(
    string                             ClientRef,
    string                             RegisterId,
    decimal                            OpeningCash,
    DateTime                           OpenedAt,
    string?                            Notes,
    OfflineCloseInfo?                  Close,
    IReadOnlyList<OfflineEventPayload> Events);

public sealed record OfflineCloseInfo(decimal ClosingCash, DateTime ClosedAt, string? Notes);

/// <summary>Kind ∈ "sale" | "refund" | "void" | "cash".</summary>
public sealed record OfflineEventPayload(
    string                          ClientRef,
    string                          Kind,
    DateTime                        OccurredAt,
    string?                         ReceiptNumber = null,
    // sale / refund
    Guid?                           CustomerId    = null,
    IReadOnlyList<LineItemRequest>? LineItems     = null,
    IReadOnlyList<PaymentRequest>?  Payments      = null,
    OrderDiscountRequest?           OrderDiscount = null,
    string?                         Notes         = null,
    // refund / void — the target is either another offline record or a server transaction
    string?                         TargetClientRef     = null,
    Guid?                           TargetTransactionId = null,
    // cash movement
    string?                         CashType = null,
    decimal?                        Amount   = null,
    string?                         Reason   = null);

public sealed record OfflineSyncResultDto(
    Guid                                   BatchId,
    int                                    Applied,
    int                                    Duplicates,
    int                                    Rejected,
    IReadOnlyList<OfflineSessionResultDto> Sessions,
    IReadOnlyList<OfflineEventResultDto>   Events,
    IReadOnlyList<NegativeStockDto>        NegativeStock);

/// <summary>Status ∈ "synced" | "open" | "rejected".</summary>
public sealed record OfflineSessionResultDto(
    string  ClientRef,
    Guid?   ServerSessionId,
    string  Status,
    string? Error);

/// <summary>Status ∈ "applied" | "duplicate" | "rejected".</summary>
public sealed record OfflineEventResultDto(
    string  ClientRef,
    string  SessionClientRef,
    string  Status,
    string? ServerId,
    string? TransactionNumber,
    string? Error);

/// <summary>A product that sold past zero while offline — the sale stands, stock needs attention.</summary>
public sealed record NegativeStockDto(Guid ProductId, string Name, decimal StockQuantity);

public sealed class SyncOfflineDayCommandValidator : AbstractValidator<SyncOfflineDayCommand>
{
    public SyncOfflineDayCommandValidator()
    {
        RuleFor(x => x.BatchId).NotEmpty();
        RuleFor(x => x.RegisterId).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Sessions).NotEmpty().WithMessage("Nothing to sync.");
        RuleFor(x => x.Sessions.Sum(s => s.Events.Count)).LessThanOrEqualTo(5000)
            .WithMessage("Too many records in one sync — sync more often, or split the upload.");

        RuleForEach(x => x.Sessions).ChildRules(s =>
        {
            s.RuleFor(p => p.ClientRef).NotEmpty().MaximumLength(64);
            s.RuleFor(p => p.RegisterId).NotEmpty().MaximumLength(50);
            s.RuleFor(p => p.OpeningCash).GreaterThanOrEqualTo(0);
            s.RuleForEach(p => p.Events).ChildRules(e =>
            {
                e.RuleFor(v => v.ClientRef).NotEmpty().MaximumLength(64);
                e.RuleFor(v => v.Kind).Must(k => k is "sale" or "refund" or "void" or "cash")
                    .WithMessage("Unknown offline event kind.");
            });
        });
    }
}
