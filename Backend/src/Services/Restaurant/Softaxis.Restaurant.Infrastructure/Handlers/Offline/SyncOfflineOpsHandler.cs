using MediatR;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Offline;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Offline;

/// <summary>
/// Replays a till's offline queue. Each action is applied on its own: one that fails (say, a payment
/// for a bill nobody can find) is reported and never blocks the rest. A previously applied action is
/// skipped; a previously rejected one is retried, since what stopped it may have been fixed since
/// (most often: no till was open, and now one is).
/// </summary>
internal sealed class SyncOfflineOpsHandler(RestaurantDbContext db, ISender sender, ICurrentUser currentUser)
    : ICommandHandler<SyncOfflineOpsCommand, OfflineSyncResultDto>
{
    public async Task<Result<OfflineSyncResultDto>> Handle(SyncOfflineOpsCommand cmd, CancellationToken ct)
    {
        var results = new List<OfflineOpResultDto>();
        int applied = 0, already = 0, rejected = 0;

        foreach (var op in cmd.Ops)
        {
            var prior = await db.OfflineOps.FirstOrDefaultAsync(x => x.OpId == op.OpId, ct);
            if (prior is { Status: "applied" })
            {
                already++;
                results.Add(new(op.OpId, "duplicate", null, prior.OrderId, op.OrderClientRef, await NumberOf(prior.OrderId, ct)));
                continue;
            }
            if (prior is not null) { db.OfflineOps.Remove(prior); await db.SaveChangesAsync(ct); }

            var orderId = op.OrderId ?? await ResolveAsync(op.OrderClientRef, ct);

            // Adding items and taking a payment are the two actions a repeat would corrupt (twice the
            // food, twice the money). They commit together with their log row, so a crash between the
            // two can never leave one without the other. Create is guarded by its ClientRef and send /
            // serve by the order's status; serve also opens its own transaction for the stock
            // deduction, so it must not be wrapped here.
            var atomic = op.Kind is "addItems" or "pay";
            var tx = atomic ? await db.Database.BeginTransactionAsync(ct) : null;

            Result<Guid?> outcome;
            try
            {
                outcome = await ApplyAsync(op, orderId, ct);
                if (outcome.IsSuccess)
                {
                    var ok = new OfflineOp(op.OpId, op.Kind, op.OccurredAtUtc, currentUser.Id);
                    ok.Applied(outcome.Value ?? orderId);
                    db.OfflineOps.Add(ok);
                    await db.SaveChangesAsync(ct);
                    if (tx is not null) await tx.CommitAsync(ct);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                outcome = Result.Failure<Guid?>(Error.Custom("Offline.Failed", ex.Message));
            }

            if (outcome.IsFailure)
            {
                if (tx is not null) await tx.RollbackAsync(ct);
                // A failed command may have left changes half made in the shared context; drop them
                // before recording the rejection so they are never saved by accident.
                db.ChangeTracker.Clear();
                var no = new OfflineOp(op.OpId, op.Kind, op.OccurredAtUtc, currentUser.Id);
                no.Rejected(orderId, outcome.Error.Description);
                db.OfflineOps.Add(no);
                await db.SaveChangesAsync(ct);
            }
            if (tx is not null) await tx.DisposeAsync();

            if (outcome.IsSuccess) applied++; else rejected++;
            var finalId = outcome.IsSuccess ? outcome.Value ?? orderId : orderId;
            results.Add(new(op.OpId, outcome.IsSuccess ? "applied" : "rejected",
                outcome.IsFailure ? outcome.Error.Description : null,
                finalId, op.OrderClientRef, await NumberOf(finalId, ct)));
        }

        return Result.Success(new OfflineSyncResultDto(applied, already, rejected, results));
    }

    private async Task<Result<Guid?>> ApplyAsync(OfflineOpInput op, Guid? orderId, CancellationToken ct)
    {
        if (op.Kind == "create")
        {
            var c = op.Create!;
            var created = await sender.Send(new CreateOrderCommand(
                c.TableId, c.Waiter, c.Covers, c.OrderType, c.Notes, c.Items, c.BranchId, c.SessionId, c.CustomerId,
                new OfflineOrderContext(op.OrderClientRef!, op.OccurredAtUtc)), ct);
            return created.IsSuccess ? Result.Success<Guid?>(created.Value.Id) : Result.Failure<Guid?>(created.Error);
        }

        if (orderId is null)
            return Result.Failure<Guid?>(Error.Custom("Offline.Failed",
                "The bill this action belongs to was not found — its order was not uploaded."));
        var id = orderId.Value;

        // Status moves already made on another device are not errors: the bill is where it should be.
        var status = await db.Orders.AsNoTracking().Where(o => o.Id == id).Select(o => o.Status).FirstOrDefaultAsync(ct);
        if (op.Kind == "send" && status is not null and not "open") return Result.Success<Guid?>(id);
        if (op.Kind == "serve" && status is "served" or "paid") return Result.Success<Guid?>(id);

        Result r = op.Kind switch
        {
            "addItems" => await sender.Send(new AddOrderItemsCommand(id, op.Items!, Offline: true), ct),
            "send"     => await sender.Send(new SendOrderToKitchenCommand(id), ct),
            "serve"    => await sender.Send(new ServeOrderCommand(id), ct),
            "pay"      => await sender.Send(new AddOrderPaymentCommand(id, op.Payment!.Method, op.Payment.Amount, op.Payment.Reference), ct),
            _          => Result.Failure(Error.Custom("Offline.Failed", "Unknown offline action.")),
        };
        return r.IsSuccess ? Result.Success<Guid?>(id) : Result.Failure<Guid?>(r.Error);
    }

    private async Task<Guid?> ResolveAsync(string? clientRef, CancellationToken ct) =>
        string.IsNullOrEmpty(clientRef) ? null
            : await db.Orders.AsNoTracking().Where(o => o.ClientRef == clientRef && !o.IsDeleted)
                .Select(o => (Guid?)o.Id).FirstOrDefaultAsync(ct);

    private async Task<string?> NumberOf(Guid? id, CancellationToken ct) =>
        id is null ? null : await db.Orders.AsNoTracking().Where(o => o.Id == id).Select(o => o.OrderNumber).FirstOrDefaultAsync(ct);
}
