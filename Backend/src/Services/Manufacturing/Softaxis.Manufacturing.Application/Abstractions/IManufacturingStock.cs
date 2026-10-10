using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.Manufacturing.Application.Abstractions;

/// <summary>A stock item as Manufacturing needs to see it.</summary>
public sealed record StockItem(
    Guid Id, string Name, string? Sku, string Unit, decimal CostPrice, decimal StockQuantity);

public sealed record StockWarehouse(Guid Id, string Name, bool IsDefault);

/// <summary>
/// The only door from Manufacturing into the stock ledger. Products, warehouses and on-hand
/// quantities belong to Inventory; this module reads them and asks for movements, and never
/// writes a stock table itself.
/// </summary>
public interface IManufacturingStock
{
    Task<StockItem?> GetItemAsync(Guid productId, CancellationToken ct);

    /// <summary>
    /// What an order drawing from <paramref name="warehouseId"/> can actually take. That is the
    /// warehouse's own quantity when Inventory's per-warehouse figures add up to the product total;
    /// otherwise (stock entered without a warehouse, or no warehouse on the order) the product
    /// total. Null when the product no longer exists.
    /// </summary>
    Task<decimal?> GetAvailableAsync(Guid productId, Guid? warehouseId, CancellationToken ct);

    Task<IReadOnlyList<StockItem>> SearchItemsAsync(string? search, int take, CancellationToken ct);

    Task<IReadOnlyList<StockWarehouse>> GetWarehousesAsync(CancellationToken ct);

    /// <summary>Takes a component out of stock for a production order.</summary>
    Task<Result> IssueAsync(Guid productId, decimal quantity, decimal unitCost, Guid? warehouseId,
        string orderNumber, string? batchNumber, CancellationToken ct);

    /// <summary>Puts an unused component back into stock from a production order.</summary>
    Task<Result> ReturnAsync(Guid productId, decimal quantity, decimal unitCost, Guid? warehouseId,
        string orderNumber, string? batchNumber, CancellationToken ct);

    /// <summary>Puts finished goods (or a by-product) into stock from a production order.</summary>
    Task<Result> ReceiveAsync(Guid productId, decimal quantity, decimal unitCost, Guid? warehouseId,
        string orderNumber, string? batchNumber, DateTime? expiryDate, CancellationToken ct);
}
