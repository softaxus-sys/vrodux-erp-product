namespace Softaxis.POS.Application.Abstractions;

public sealed record LowStockRow(
    Guid    Id,
    string  Name,
    string? Sku,
    string? Barcode,
    string  Category,
    string  Unit,
    decimal StockQuantity,
    decimal ReorderLevel,
    decimal CostPrice,
    decimal SoldInPeriod);

/// <summary>Reads low and out-of-stock products across the pos and inventory schemas.</summary>
public interface ILowStockReadService
{
    Task<IReadOnlyList<LowStockRow>> GetLowStockAsync(int salesDays, CancellationToken ct = default);
}
