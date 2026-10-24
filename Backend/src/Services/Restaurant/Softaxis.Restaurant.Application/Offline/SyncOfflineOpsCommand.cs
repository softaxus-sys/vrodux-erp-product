using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Offline;

/// <summary>
/// POST /api/restaurant/offline/sync — uploads the actions a till queued while it could not reach
/// the server, in the order they happened. Each action is applied through the same command a live
/// till uses (so permissions, branch checks and totals are identical) and recorded by its OpId, so
/// uploading the same queue again applies nothing twice.
/// </summary>
public sealed record SyncOfflineOpsCommand(IReadOnlyList<OfflineOpInput> Ops) : ICommand<OfflineSyncResultDto>;

/// <summary>
/// One queued action.
/// <para><c>Kind</c>: <c>create</c> | <c>addItems</c> | <c>send</c> | <c>serve</c> | <c>pay</c>.</para>
/// <para>The order is named by <c>OrderId</c> when it existed on the server before the till went
/// offline, or by <c>OrderClientRef</c> when the till created it offline (its server id is not
/// known yet — it is resolved here, from the <c>create</c> earlier in the same queue or a past upload).</para>
/// </summary>
public sealed record OfflineOpInput(
    string OpId,
    string Kind,
    DateTime OccurredAtUtc,
    Guid? OrderId,
    string? OrderClientRef,
    OfflineCreatePayload? Create,
    IReadOnlyList<OrderLineInput>? Items,
    OfflinePaymentPayload? Payment);

public sealed record OfflineCreatePayload(
    Guid? TableId, string Waiter, int Covers, string OrderType, string? Notes,
    Guid? BranchId, Guid? SessionId, Guid? CustomerId, IReadOnlyList<OrderLineInput> Items);

public sealed record OfflinePaymentPayload(string Method, decimal Amount, string? Reference);

public sealed record OfflineOpResultDto(
    string OpId, string Status, string? Error, Guid? OrderId, string? OrderClientRef, string? OrderNumber);

public sealed record OfflineSyncResultDto(
    int Applied, int AlreadyApplied, int Rejected, IReadOnlyList<OfflineOpResultDto> Results);

public sealed class SyncOfflineOpsCommandValidator : AbstractValidator<SyncOfflineOpsCommand>
{
    public static readonly string[] Kinds = ["create", "addItems", "send", "serve", "pay"];

    public SyncOfflineOpsCommandValidator()
    {
        RuleFor(x => x.Ops).NotNull().Must(o => o.Count <= 500)
            .WithMessage("Upload at most 500 offline actions at a time.");
        RuleForEach(x => x.Ops).ChildRules(op =>
        {
            op.RuleFor(o => o.OpId).NotEmpty().MaximumLength(64);
            op.RuleFor(o => o.Kind).Must(k => Kinds.Contains(k)).WithMessage("Unknown offline action.");
            op.RuleFor(o => o.Create).NotNull().When(o => o.Kind == "create");
            op.RuleFor(o => o.OrderClientRef).NotEmpty().MaximumLength(64).When(o => o.Kind == "create");
            op.RuleFor(o => o.Items).NotEmpty().When(o => o.Kind == "addItems");
            op.RuleFor(o => o.Payment).NotNull().When(o => o.Kind == "pay");
        });
    }
}
