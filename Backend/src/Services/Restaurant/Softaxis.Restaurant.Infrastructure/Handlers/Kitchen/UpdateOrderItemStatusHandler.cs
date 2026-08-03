using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Infrastructure.Persistence;
using Softaxis.Recipe.Infrastructure.Persistence;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Kitchen.Commands;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Kitchen;

internal sealed class UpdateOrderItemStatusHandler(
    RestaurantDbContext db, RecipeDbContext recipeDb, InventoryDbContext inventoryDb, IRestaurantRealtimeNotifier realtime,
    ILogger<UpdateOrderItemStatusHandler> logger)
    : ICommandHandler<UpdateOrderItemStatusCommand, UpdateOrderItemStatusResult>
{
    public async Task<Result<UpdateOrderItemStatusResult>> Handle(UpdateOrderItemStatusCommand cmd, CancellationToken ct)
    {
        var item = await db.OrderItems.FindAsync([cmd.ItemId], ct);
        if (item is null || item.IsDeleted)
            return Result.Failure<UpdateOrderItemStatusResult>(Error.NotFoundById("OrderItem", cmd.ItemId));

        // Idempotency guard — only a genuine pending/preparing/ready → served transition deducts
        // stock; re-marking an already-served item (or any other status change) must not double-deduct.
        // (OrderItem.StockDeducted is a second, entity-level guard against the SAME line being
        // deducted via this per-item path AND the whole-order ServeOrderHandler path.)
        var justServed = cmd.Status == "served" && item.Status != "served";

        // Marking served and deducting recipe stock spans 3 DbContexts (Restaurant/Recipe/Inventory)
        // that all point at the same physical database — share one real transaction across them so
        // it's all-or-nothing instead of 3 independent commits.
        await using (var scope = await SharedTransactionScope.BeginAsync(db, recipeDb, inventoryDb, ct))
        {
            item.UpdateStatus(cmd.Status);
            await db.SaveChangesAsync(ct);

            if (justServed)
            {
                var order = await db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == item.OrderId, ct);
                await RecipeDeductionSupport.DeductForServedItemAsync(
                    db, recipeDb, inventoryDb, item, order?.OrderNumber ?? item.OrderId.ToString(), logger, ct);
            }

            await scope.CommitAsync(ct);
        }

        await realtime.NotifyKitchenChangedAsync(ct);
        return Result.Success(new UpdateOrderItemStatusResult(item.Id, item.Status));
    }
}
