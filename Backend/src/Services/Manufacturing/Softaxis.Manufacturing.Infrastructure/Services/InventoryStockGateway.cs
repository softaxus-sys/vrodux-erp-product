using MediatR;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Inventory.Application.Abstractions;
using Softaxis.Inventory.Application.ProductStock.Queries.GetProductStockByProduct;
using Softaxis.Inventory.Application.StockMovements.Commands.CreateStockMovement;
using Softaxis.Inventory.Application.Warehouses.Queries.GetWarehouses;
using Softaxis.Inventory.Domain.Constants;
using Softaxis.Manufacturing.Application.Abstractions;

namespace Softaxis.Manufacturing.Infrastructure.Services;

/// <summary>
/// <see cref="IManufacturingStock"/> over the Inventory module. Movements are sent as Inventory's
/// own <see cref="CreateStockMovementCommand"/>, so the product total, the per-warehouse bucket,
/// the batch and the movement trail are updated by the one handler that already owns them.
/// <para>
/// Each movement is its own Inventory transaction. A production order that issues several
/// components therefore records them one by one — see <c>ProductionOrderSupport.IssueAsync</c>.
/// </para>
/// </summary>
internal sealed class InventoryStockGateway(IProductReadService products, ISender sender) : IManufacturingStock
{
    public async Task<StockItem?> GetItemAsync(Guid productId, CancellationToken ct)
    {
        var p = await products.GetByIdAsync(productId, ct);
        return p is null ? null : new StockItem(p.Id, p.Name, p.SKU, UnitOf(p.UnitOfMeasureSymbol, p.Unit), p.CostPrice, p.StockQuantity);
    }

    public async Task<decimal?> GetAvailableAsync(Guid productId, Guid? warehouseId, CancellationToken ct)
    {
        var item = await GetItemAsync(productId, ct);
        if (item is null) return null;
        if (warehouseId is null) return item.StockQuantity;

        var byWarehouse = await sender.Send(new GetProductStockByProductQuery(productId), ct);
        if (byWarehouse.IsFailure) return item.StockQuantity;

        // The warehouse figure is only trusted when the warehouses together account for the whole
        // product total. Opening stock entered without a warehouse leaves the buckets short, and
        // holding an order to a bucket that was never filled would block stock that is really there.
        var rows = byWarehouse.Value.Warehouses;
        if (Math.Abs(rows.Sum(r => r.Quantity) - item.StockQuantity) > 0.0001m) return item.StockQuantity;

        return rows.FirstOrDefault(r => r.WarehouseId == warehouseId)?.Quantity ?? 0;
    }

    public async Task<IReadOnlyList<StockItem>> SearchItemsAsync(string? search, int take, CancellationToken ct)
    {
        var page = await products.GetCombinedPagedAsync(1, take,
            string.IsNullOrWhiteSpace(search) ? null : search.Trim(), isActive: true, ct: ct);

        return page.Items
            .Select(p => new StockItem(p.Id, p.Name, p.SKU, UnitOf(p.UnitOfMeasureSymbol, p.Unit), p.CostPrice, p.StockQuantity))
            .ToList();
    }

    public async Task<IReadOnlyList<StockWarehouse>> GetWarehousesAsync(CancellationToken ct)
    {
        var result = await sender.Send(new GetWarehousesQuery(), ct);
        if (result.IsFailure) return [];

        return result.Value
            .Where(w => w.IsActive)
            .OrderByDescending(w => w.IsDefault).ThenBy(w => w.Name)
            .Select(w => new StockWarehouse(w.Id, w.Name, w.IsDefault))
            .ToList();
    }

    public Task<Result> IssueAsync(Guid productId, decimal quantity, decimal unitCost, Guid? warehouseId,
        string orderNumber, string? batchNumber, CancellationToken ct) =>
        MoveAsync(productId, MovementTypes.ProductionIssue, quantity, unitCost, warehouseId, orderNumber,
            $"Issued to production order {orderNumber}", batchNumber, null, ct);

    public Task<Result> ReturnAsync(Guid productId, decimal quantity, decimal unitCost, Guid? warehouseId,
        string orderNumber, string? batchNumber, CancellationToken ct) =>
        MoveAsync(productId, MovementTypes.ProductionReturn, quantity, unitCost, warehouseId, orderNumber,
            $"Returned from production order {orderNumber}", batchNumber, null, ct);

    public Task<Result> ReceiveAsync(Guid productId, decimal quantity, decimal unitCost, Guid? warehouseId,
        string orderNumber, string? batchNumber, DateTime? expiryDate, CancellationToken ct) =>
        MoveAsync(productId, MovementTypes.ProductionReceipt, quantity, unitCost, warehouseId, orderNumber,
            $"Finished goods from production order {orderNumber}", batchNumber, expiryDate, ct);

    private async Task<Result> MoveAsync(Guid productId, string type, decimal quantity, decimal unitCost,
        Guid? warehouseId, string reference, string notes, string? batchNumber, DateTime? expiryDate, CancellationToken ct)
    {
        var result = await sender.Send(new CreateStockMovementCommand(
            productId, type, quantity, unitCost, reference, notes, warehouseId,
            string.IsNullOrWhiteSpace(batchNumber) ? null : batchNumber.Trim(), expiryDate), ct);
        return result.IsSuccess ? Result.Success() : Result.Failure(result.Error);
    }

    private static string UnitOf(string? uomSymbol, string? unit) =>
        !string.IsNullOrWhiteSpace(uomSymbol) ? uomSymbol! : string.IsNullOrWhiteSpace(unit) ? "pcs" : unit!;
}
