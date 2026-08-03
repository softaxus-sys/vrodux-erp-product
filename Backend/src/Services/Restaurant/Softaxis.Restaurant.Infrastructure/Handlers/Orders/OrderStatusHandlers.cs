using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Infrastructure.Persistence;
using Softaxis.Recipe.Infrastructure.Persistence;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Orders.Commands;
using Softaxis.Restaurant.Application.Orders.Dtos;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class SendOrderToKitchenHandler(RestaurantDbContext db, IRestaurantRealtimeNotifier realtime)
    : ICommandHandler<SendOrderToKitchenCommand, OrderStatusDto>
{
    public Task<Result<OrderStatusDto>> Handle(SendOrderToKitchenCommand cmd, CancellationToken ct) =>
        ConcurrencyRetry.ExecuteAsync(db, async () =>
        {
            var o = await db.Orders.FindAsync([cmd.OrderId], ct);
            if (o is null || o.IsDeleted)
                return Result.Failure<OrderStatusDto>(Error.NotFoundById("Order", cmd.OrderId));

            o.SendToKitchen();
            await db.SaveChangesAsync(ct);
            await realtime.NotifyKitchenChangedAsync(ct);
            return Result.Success(new OrderStatusDto(o.Id, o.Status));
        });
}

internal sealed class MarkOrderReadyHandler(RestaurantDbContext db, IRestaurantRealtimeNotifier realtime)
    : ICommandHandler<MarkOrderReadyCommand, OrderStatusDto>
{
    public Task<Result<OrderStatusDto>> Handle(MarkOrderReadyCommand cmd, CancellationToken ct) =>
        ConcurrencyRetry.ExecuteAsync(db, async () =>
        {
            var o = await db.Orders.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == cmd.OrderId, ct);
            if (o is null || o.IsDeleted)
                return Result.Failure<OrderStatusDto>(Error.NotFoundById("Order", cmd.OrderId));

            o.MarkReady();
            await db.SaveChangesAsync(ct);
            await realtime.NotifyKitchenChangedAsync(ct);
            return Result.Success(new OrderStatusDto(o.Id, o.Status));
        });
}

internal sealed class ServeOrderHandler(
    RestaurantDbContext db, RecipeDbContext recipeDb, InventoryDbContext inventoryDb, IRestaurantRealtimeNotifier realtime,
    ILogger<ServeOrderHandler> logger)
    : ICommandHandler<ServeOrderCommand, OrderStatusDto>
{
    public Task<Result<OrderStatusDto>> Handle(ServeOrderCommand cmd, CancellationToken ct) =>
        ConcurrencyRetry.ExecuteAsync(db, async () =>
        {
            var o = await db.Orders.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == cmd.OrderId, ct);
            if (o is null || o.IsDeleted)
                return Result.Failure<OrderStatusDto>(Error.NotFoundById("Order", cmd.OrderId));

            // Idempotency guard — Serve() has no built-in transition check, so a repeated "Serve"
            // click (e.g. a double-tap) must not deduct recipe-linked stock a second time. Each
            // individual line is ALSO guarded via OrderItem.StockDeducted (skipped at the query
            // level in DeductForServedOrderAsync), covering a line already deducted via the
            // per-item kitchen-status path before this whole-order serve ran.
            var alreadyServed = o.Status == "served";

            // Marking served and deducting recipe stock spans 3 DbContexts (Restaurant/Recipe/
            // Inventory) that all point at the same physical database — share one real transaction
            // across them so it's all-or-nothing instead of 3 independent commits.
            await using (var scope = await SharedTransactionScope.BeginAsync(db, recipeDb, inventoryDb, ct))
            {
                o.Serve();
                await db.SaveChangesAsync(ct);

                if (!alreadyServed)
                    await RecipeDeductionSupport.DeductForServedOrderAsync(db, recipeDb, inventoryDb, o.Id, o.OrderNumber, logger, ct);

                await scope.CommitAsync(ct);
            }

            await realtime.NotifyKitchenChangedAsync(ct);
            return Result.Success(new OrderStatusDto(o.Id, o.Status));
        });
}

