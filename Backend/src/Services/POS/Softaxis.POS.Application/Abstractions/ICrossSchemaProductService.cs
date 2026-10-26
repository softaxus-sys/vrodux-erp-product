namespace Softaxis.POS.Application.Abstractions;

/// <summary>
/// View of a product for POS sale processing — works across both
/// pos.products and inventory.products schemas.
/// </summary>
public sealed record ProductSaleView(
    Guid    Id,
    string  Name,
    string? SKU,
    string? Barcode,
    decimal SalePrice,
    decimal TaxRate,
    string  Unit,
    decimal StockQuantity,
    decimal ReorderLevel,
    bool    IsActive,
    bool    TrackInventory,
    /// <summary>"pos" or "inventory" — determines which table to deduct stock from.</summary>
    string  Schema,
    /// <summary>
    /// Set when the stock figure above is one BRANCH's (pos.branch_stock). Null means head-office / central stock.
    /// </summary>
    Guid?   StockBranchId = null,
    /// <summary>Set when the figure above is one warehouse's bucket (a branch's warehouse in the Inventory module).</summary>
    Guid?   StockWarehouseId = null);

/// <summary>
/// Cross-schema product lookup and stock-deduction service.
/// Checks pos.products first, then inventory.products, so products created
/// in either module can be sold at the POS terminal.
/// </summary>
public interface ICrossSchemaProductService
{
    /// <summary>
    /// Find a product by ID in pos.products or inventory.products.
    /// Returns null if not found in either schema.
    /// </summary>
    /// <param name="branchId">
    /// The branch making the sale. When that branch keeps its own stock of the product, the view carries THAT
    /// branch's quantity (and the deduct/restore below act on it), so one branch's sale never touches another's.
    /// Null, or a branch with no stock of its own, gives head-office stock as before.
    /// </param>
    Task<ProductSaleView?> GetByIdForSaleAsync(Guid id, Guid? branchId = null, CancellationToken ct = default);

    /// <summary>Branch quantities for a set of POS products, for showing the right stock on the till. Only products the branch holds its own stock of are returned.</summary>
    Task<IReadOnlyDictionary<Guid, decimal>> GetBranchQuantitiesAsync(Guid branchId, IReadOnlyCollection<Guid> productIds, CancellationToken ct = default);

    /// <summary>Sets a POS product's quantity in one branch by a delta (stock in / out / count correction), recording the movement.</summary>
    Task<decimal> AdjustBranchStockAsync(Guid productId, Guid branchId, decimal delta, string adjustmentType, string? reference, string? notes, Guid userId, CancellationToken ct = default);

    /// <summary>
    /// Deduct stock and record a stock movement in the correct schema.
    /// No-op if the product does not track inventory.
    /// </summary>
    Task DeductStockAsync(
        ProductSaleView product,
        decimal         quantity,
        string          transactionNumber,
        Guid            cashierId,
        Guid            transactionId,
        CancellationToken ct = default);

    /// <summary>
    /// Restore stock (e.g. on refund/return) and record a Return movement in the
    /// correct schema. No-op if the product does not track inventory.
    /// </summary>
    Task RestoreStockAsync(
        ProductSaleView product,
        decimal         quantity,
        string          transactionNumber,
        Guid            cashierId,
        Guid            transactionId,
        CancellationToken ct = default);
}
