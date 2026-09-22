using MediatR;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.Common;
using Softaxis.POS.Application.Sessions.Commands.RecordCashMovement;
using Softaxis.POS.Application.Transactions.Commands.CreateSale;
using Softaxis.POS.Application.Transactions.Commands.RefundTransaction;
using Softaxis.POS.Application.Transactions.Commands.VoidTransaction;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.OfflineSync;

/// <summary>
/// Replays an offline till's day through the SAME command handlers the online till uses, so
/// pricing, tax, discounts, loyalty and stock movements are computed identically. The offline
/// differences are confined to <see cref="OfflineContext"/>: backdated timestamps, a ClientRef for
/// idempotency, and no refusal on stock that ran out — the goods already left the shop.
///
/// Each event commits on its own. A rejected event never blocks the rest, and a retried sync picks
/// up exactly where the last one stopped.
/// </summary>
public sealed class SyncOfflineDayCommandHandler(
    ISender                    sender,
    IPosSettingsRepository     settingsRepo,
    IPOSSessionRepository      sessionRepo,
    IPOSTransactionRepository  txnRepo,
    ICashMovementRepository    movementRepo,
    ICrossSchemaProductService productLookup,
    ICurrentUser               currentUser,
    IUnitOfWork                uow)
    : ICommandHandler<SyncOfflineDayCommand, OfflineSyncResultDto>
{
    public async Task<Result<OfflineSyncResultDto>> Handle(SyncOfflineDayCommand cmd, CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated || !currentUser.Id.HasValue)
            return Result.Failure<OfflineSyncResultDto>(Error.Custom("OfflineSync.Unauthorized",
                "Sign in again to sync this till."));

        // Deliberately NOT gated on the tenant's current mode. Switching to online is refused while tills
        // hold unsynced records, and when an administrator forces it anyway the affected till is locked
        // on a "sync first" screen — refusing its upload here would strand real sales forever.

        // Pre-flight the elevated event kinds. Replayed events run through the normal handlers with
        // the SYNCING user's permissions, so a queue holding refunds, voids or discounted sales
        // would otherwise be accepted, replay, and have those records rejected one by one at the
        // very end of the day. Failing up front — before anything is written — tells the operator
        // to fetch a supervisor while the shift is still open and recoverable.
        var events = cmd.Sessions.SelectMany(s => s.Events).ToList();

        static string Need(string what, int n) =>
            $"This till's queue holds {n} {what}. A user with permission to {what.TrimEnd('s')} must sync it.";

        var refunds = events.Count(e => e.Kind == "refund");
        if (refunds > 0 && !currentUser.HasPermission("pos.transactions.refund"))
            return Result.Failure<OfflineSyncResultDto>(
                Error.Custom("OfflineSync.Forbidden", Need("refunds", refunds)));

        var voids = events.Count(e => e.Kind == "void");
        if (voids > 0 && !currentUser.HasPermission("pos.transactions.void"))
            return Result.Failure<OfflineSyncResultDto>(
                Error.Custom("OfflineSync.Forbidden", Need("voids", voids)));

        var discounted = events.Count(e =>
            e.Kind == "sale" &&
            ((e.LineItems?.Any(i => i.DiscountPercent > 0 || i.DiscountAmount > 0 || i.UnitPriceOverride.HasValue) ?? false)
             || e.OrderDiscount?.Type is "percentage" or "fixed"));
        if (discounted > 0 && !currentUser.HasPermission("pos.transactions.discount"))
            return Result.Failure<OfflineSyncResultDto>(Error.Custom("OfflineSync.Forbidden",
                $"This till's queue holds {discounted} discounted sale(s). A user with permission to apply discounts must sync it."));

        var sessionResults = new List<OfflineSessionResultDto>();
        var eventResults   = new List<OfflineEventResultDto>();
        var soldProducts   = new HashSet<Guid>();
        // ClientRef → server transaction id, so a refund or void of a sale made earlier in the same
        // upload can find it without a round trip.
        var txnByClientRef = new Dictionary<string, Guid>(StringComparer.Ordinal);

        foreach (var s in cmd.Sessions)
        {
            var session = await EnsureSessionAsync(s, ct);
            if (session.IsFailure)
            {
                sessionResults.Add(new(s.ClientRef, null, "rejected", session.Error.Description));
                foreach (var e in s.Events)
                    eventResults.Add(new(e.ClientRef, s.ClientRef, "rejected", null, null,
                        "Shift could not be created on the server: " + session.Error.Description));
                continue;
            }

            var serverSession = session.Value;
            var rejectedHere  = 0;

            foreach (var e in s.Events)
            {
                OfflineEventResultDto result;
                try
                {
                    result = await ApplyEventAsync(e, s.ClientRef, serverSession, txnByClientRef, soldProducts, ct);
                }
                catch (Exception ex)
                {
                    result = new(e.ClientRef, s.ClientRef, "rejected", null, null, ex.GetBaseException().Message);
                }

                if (result.Status == "rejected")
                {
                    rejectedHere++;
                    // A failed step may have mutated tracked entities (voucher usage, loyalty points)
                    // before bailing out; without this the next event's save would persist them.
                    uow.DiscardChanges();
                }
                eventResults.Add(result);
            }

            sessionResults.Add(await CloseIfRequestedAsync(s, serverSession.Id, rejectedHere, cmd.ForceClose, ct));
        }

        var negative = await FindNegativeStockAsync(soldProducts, ct);

        var applied    = eventResults.Count(r => r.Status == "applied");
        var duplicates = eventResults.Count(r => r.Status == "duplicate");
        var rejected   = eventResults.Count(r => r.Status == "rejected");

        await RecordBatchAsync(cmd, applied, duplicates, rejected, ct);

        return Result.Success(new OfflineSyncResultDto(
            cmd.BatchId, applied, duplicates, rejected, sessionResults, eventResults, negative));
    }

    // ── Shift ─────────────────────────────────────────────────────────────────

    private async Task<Result<POSSession>> EnsureSessionAsync(OfflineSessionPayload s, CancellationToken ct)
    {
        var existing = await sessionRepo.GetByClientRefAsync(s.ClientRef, ct);
        if (existing is not null) return Result.Success(existing);

        // Deliberately NOT OpenSessionCommand: its one-open-shift-per-register/cashier rules describe
        // the live till, and this shift is history — it may overlap a shift opened online since.
        var open = POSSession.Open(currentUser.Id!.Value, s.RegisterId, s.OpeningCash);
        if (open.IsFailure) return open;

        var session = open.Value;
        session.MarkOffline(s.ClientRef, ToUtc(s.OpenedAt), s.Notes);
        session.CreatedAt = DateTime.UtcNow;
        session.CreatedBy = currentUser.Username ?? "offline-sync";
        sessionRepo.Add(session);
        await uow.SaveChangesAsync(ct);
        return Result.Success(session);
    }

    private async Task<OfflineSessionResultDto> CloseIfRequestedAsync(
        OfflineSessionPayload s, Guid serverSessionId, int rejectedHere, bool forceClose, CancellationToken ct)
    {
        var session = await sessionRepo.GetByIdAsync(serverSessionId, ct);
        if (session is null)
            return new(s.ClientRef, serverSessionId, "rejected", "Shift disappeared during sync.");

        if (session.Status == SessionStatus.Closed)
            return new(s.ClientRef, session.Id, "synced", null);

        if (s.Close is null)
            return new(s.ClientRef, session.Id, "open", null);

        // Closing locks the shift's Z-report. With rejected records still outstanding that report
        // would be missing money the drawer actually took, so hold it open unless told otherwise.
        if (rejectedHere > 0 && !forceClose)
            return new(s.ClientRef, session.Id, "open",
                $"{rejectedHere} record(s) were rejected, so the shift was left open. Fix them and sync again, or close anyway.");

        var close = session.Close(s.Close.ClosingCash, s.Close.Notes);
        if (close.IsFailure)
            return new(s.ClientRef, session.Id, "rejected", close.Error.Description);

        session.BackdateClosed(ToUtc(s.Close.ClosedAt));
        sessionRepo.Update(session);
        await uow.SaveChangesAsync(ct);
        return new(s.ClientRef, session.Id, "synced", null);
    }

    // ── Events ────────────────────────────────────────────────────────────────

    private async Task<OfflineEventResultDto> ApplyEventAsync(
        OfflineEventPayload e, string sessionRef, POSSession session,
        Dictionary<string, Guid> txnByClientRef, HashSet<Guid> soldProducts, CancellationToken ct)
    {
        var offline = new OfflineContext(e.ClientRef, ToUtc(e.OccurredAt), e.ReceiptNumber);

        OfflineEventResultDto Rejected(string error) => new(e.ClientRef, sessionRef, "rejected", null, null, error);

        switch (e.Kind)
        {
            case "sale":
            {
                var dup = await txnRepo.GetByClientRefAsync(e.ClientRef, ct);
                if (dup is not null)
                {
                    txnByClientRef[e.ClientRef] = dup.Id;
                    return new(e.ClientRef, sessionRef, "duplicate", dup.Id.ToString(), dup.TransactionNumber, null);
                }
                if (e.LineItems is null || e.Payments is null) return Rejected("Sale has no items or payments.");

                var r = await sender.Send(new CreateSaleCommand(
                    session.Id, e.CustomerId, e.LineItems, e.Payments, e.Notes, e.OrderDiscount, offline), ct);
                if (r.IsFailure) return Rejected(r.Error.Description);

                txnByClientRef[e.ClientRef] = r.Value.Id;
                foreach (var li in e.LineItems) soldProducts.Add(li.ProductId);
                return new(e.ClientRef, sessionRef, "applied", r.Value.Id.ToString(), r.Value.TransactionNumber, null);
            }

            case "refund":
            {
                var dup = await txnRepo.GetByClientRefAsync(e.ClientRef, ct);
                if (dup is not null)
                    return new(e.ClientRef, sessionRef, "duplicate", dup.Id.ToString(), dup.TransactionNumber, null);
                if (e.LineItems is null || e.Payments is null) return Rejected("Refund has no items or payments.");

                var target = await ResolveTargetAsync(e, txnByClientRef, ct);
                if (target is null) return Rejected("The sale being refunded was not found on the server.");

                var r = await sender.Send(new RefundTransactionCommand(
                    target.Value, session.Id, e.LineItems, e.Payments, e.Reason ?? e.Notes, offline), ct);
                return r.IsFailure
                    ? Rejected(r.Error.Description)
                    : new(e.ClientRef, sessionRef, "applied", r.Value.Id.ToString(), r.Value.TransactionNumber, null);
            }

            case "void":
            {
                var target = await ResolveTargetAsync(e, txnByClientRef, ct);
                if (target is null) return Rejected("The sale being voided was not found on the server.");

                // A void has no record of its own to key on, so idempotency is the target's state.
                var txn = await txnRepo.GetByIdAsync(target.Value, ct);
                if (txn is null) return Rejected("The sale being voided was not found on the server.");
                if (txn.Status == TransactionStatus.Voided)
                    return new(e.ClientRef, sessionRef, "duplicate", txn.Id.ToString(), txn.TransactionNumber, null);

                var r = await sender.Send(new VoidTransactionCommand(target.Value, e.Reason), ct);
                return r.IsFailure
                    ? Rejected(r.Error.Description)
                    : new(e.ClientRef, sessionRef, "applied", r.Value.Id.ToString(), r.Value.TransactionNumber, null);
            }

            case "cash":
            {
                var dup = await movementRepo.GetByClientRefAsync(e.ClientRef, ct);
                if (dup is not null)
                    return new(e.ClientRef, sessionRef, "duplicate", dup.Id.ToString(), null, null);

                var r = await sender.Send(new RecordCashMovementCommand(
                    session.Id, e.CashType ?? "", e.Amount ?? 0, e.Reason ?? "", offline), ct);
                return r.IsFailure
                    ? Rejected(r.Error.Description)
                    : new(e.ClientRef, sessionRef, "applied", r.Value.Id.ToString(), null, null);
            }

            default:
                return Rejected($"Unknown offline event kind '{e.Kind}'.");
        }
    }

    private async Task<Guid?> ResolveTargetAsync(
        OfflineEventPayload e, Dictionary<string, Guid> txnByClientRef, CancellationToken ct)
    {
        if (e.TargetTransactionId is { } id && id != Guid.Empty) return id;
        if (string.IsNullOrWhiteSpace(e.TargetClientRef)) return null;
        if (txnByClientRef.TryGetValue(e.TargetClientRef, out var known)) return known;

        var txn = await txnRepo.GetByClientRefAsync(e.TargetClientRef, ct);
        return txn?.Id;
    }

    // ── Reporting ─────────────────────────────────────────────────────────────

    private async Task<IReadOnlyList<NegativeStockDto>> FindNegativeStockAsync(
        HashSet<Guid> productIds, CancellationToken ct)
    {
        var list = new List<NegativeStockDto>();
        foreach (var id in productIds)
        {
            var p = await productLookup.GetByIdForSaleAsync(id, ct);
            if (p is { TrackInventory: true } && p.StockQuantity < 0)
                list.Add(new NegativeStockDto(p.Id, p.Name, p.StockQuantity));
        }
        return list.OrderBy(p => p.StockQuantity).ToList();
    }

    private async Task RecordBatchAsync(
        SyncOfflineDayCommand cmd, int applied, int duplicates, int rejected, CancellationToken ct)
    {
        try
        {
            var batch = await settingsRepo.GetBatchAsync(cmd.BatchId, ct);
            if (batch is null)
            {
                batch = OfflineSyncBatch.Start(cmd.BatchId, cmd.RegisterId, currentUser.Id!.Value);
                batch.CreatedAt = DateTime.UtcNow;
                batch.CreatedBy = currentUser.Username ?? "offline-sync";
                settingsRepo.AddBatch(batch);
            }
            batch.Record(cmd.Sessions.Count, applied, duplicates, rejected);
            await uow.SaveChangesAsync(ct);
        }
        catch
        {
            // The audit row is a convenience. The records themselves are already committed, and
            // failing the response here would make the till think nothing synced and retry.
            uow.DiscardChanges();
        }
    }

    /// <summary>The till sends ISO timestamps with an offset; an unspecified kind is taken as UTC.</summary>
    private static DateTime ToUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc   => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _                  => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };
}
