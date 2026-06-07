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
    string  Schema);

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
    Task<ProductSaleView?> GetByIdForSaleAsync(Guid id, CancellationToken ct = default);

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
